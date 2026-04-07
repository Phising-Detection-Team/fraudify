import logging
import os
import torch
from dotenv import load_dotenv
from huggingface_hub import hf_hub_download
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
from entities.base_entity import BaseEntity
from utils.prompts import get_system_prompt_detector

load_dotenv()

logger = logging.getLogger(__name__)

# Module-level singleton cache: one slot per inference mode.
# Keys: "standard", "gguf", "accelerated". Populated on first use per mode.
_MODEL_CACHE: dict = {}

GGUF_FILENAME    = "sentra-utoledo-v2.0.gguf"
OLLAMA_MODEL     = os.getenv("OLLAMA_MODEL", "hf.co/duyle240820/sentra-utoledo-v2.0")
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


def _cuda_available() -> bool:
    return torch.cuda.is_available()


def _clear_stale_generation_flags(model) -> None:
    """Remove conflicting flags from saved generation_config."""
    cfg = getattr(model, "generation_config", None)
    if cfg is None:
        return
    for attr in ("temperature", "top_p", "top_k", "max_length"):
        if getattr(cfg, attr, None) is not None:
            setattr(cfg, attr, None)


def _get_base_model_id(adapter_model_id: str) -> str:
    """Read adapter_config.json from HuggingFace and return the base model name."""
    import json
    path = hf_hub_download(repo_id=adapter_model_id, filename="adapter_config.json")
    with open(path) as f:
        return json.load(f)["base_model_name_or_path"]


def _load_standard(model_id: str):
    """Load base model in bfloat16, apply LoRA adapter, merge weights."""
    base_model_id = _get_base_model_id(model_id)
    logger.info(f"Standard mode: loading base model '{base_model_id}' + adapter '{model_id}'...")

    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    base = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )
    model = PeftModel.from_pretrained(base, model_id)
    model = model.merge_and_unload()
    model.eval()
    _clear_stale_generation_flags(model)
    return model, tokenizer


def _load_gguf(model_id: str):
    """Load the GGUF file from HuggingFace using llama-cpp-python."""
    from llama_cpp import Llama  # optional dependency

    logger.info(f"GGUF mode: downloading '{GGUF_FILENAME}' from '{model_id}'...")
    gguf_path = hf_hub_download(repo_id=model_id, filename=GGUF_FILENAME)
    logger.info(f"GGUF mode: loading model from '{gguf_path}'...")

    llm = Llama(
        model_path=gguf_path,
        n_ctx=1024,
        n_gpu_layers=0,
        verbose=False,
    )
    return llm, None  # tokenizer is handled internally by llama_cpp


class _OllamaClient:
    """
    Minimal wrapper around Ollama's OpenAI-compatible endpoint.
    Exposes create_chat_completion() matching the llama_cpp.Llama interface
    so the service layer needs no changes.
    """

    def __init__(self, model: str, base_url: str):
        self.model = model
        self.base_url = base_url.rstrip("/")

    def create_chat_completion(self, messages, max_tokens=128, temperature=0.0, **_):
        import requests  # already in requirements.txt
        resp = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
                "format": "json",   # Ollama-native JSON mode (forces valid JSON output)
                # Cap KV cache to 1024 tokens — enough for a 2000-char email + system prompt
                # + 80-token output. Halving from 2048 cuts CPU KV-cache work ~2x.
                "options": {"num_ctx": 1024},
            },
            timeout=300,
        )
        resp.raise_for_status()
        return resp.json()


def _load_ollama(_model_id: str):
    """
    Use Ollama as a GGUF backend — no C++ compiler needed.

    Steps (all automatic on first use):
      1. Verify Ollama is running (clear error if not).
      2. Check whether the model is already pulled.
      3. Pull it if missing (~0.9 GB, one-time per machine).
      4. Return an _OllamaClient that looks like a llama_cpp.Llama instance.

    Teammates only need to install Ollama (https://ollama.com/download).
    The pull happens automatically on their first scan.
    """
    import requests  # already in requirements.txt

    # 1 — verify Ollama server is reachable
    try:
        requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
    except Exception:
        raise RuntimeError(
            "Ollama server is not running. "
            "Start it with:  ollama serve  (or launch the Ollama desktop app)."
        )

    # 2 — check whether the model is already pulled via /api/show
    # (more reliable than string-matching /api/tags, which varies by quantization tag)
    try:
        # Ollama stores models with an explicit tag (e.g. :latest or :Q4_K_M).
        # /api/show requires the full name including tag — default to :latest.
        show_name = OLLAMA_MODEL if ":" in OLLAMA_MODEL else f"{OLLAMA_MODEL}:latest"
        show_resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/show",
            json={"name": show_name},
            timeout=5,
        )
        model_pulled = show_resp.status_code == 200
        logger.info(
            "[Sentra] Ollama /api/show '%s' → HTTP %d (model_pulled=%s)",
            show_name, show_resp.status_code, model_pulled,
        )
    except Exception as e:
        logger.warning("[Sentra] Ollama /api/show check failed: %s", e)
        model_pulled = False

    # 3 — auto-pull if missing via REST API (works whether Ollama is native or in Docker)
    if not model_pulled:
        logger.info(
            "[Sentra] Ollama: pulling '%s' via REST API (~0.9 GB, first-time only)...", OLLAMA_MODEL
        )
        pull_resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/pull",
            json={"name": OLLAMA_MODEL},
            stream=True,
            timeout=1800,  # 30 min — large model on slow connection
        )
        pull_resp.raise_for_status()
        for _ in pull_resp.iter_lines():
            pass  # consume streamed progress events until pull completes
        logger.info("[Sentra] Ollama pull complete.")
    else:
        logger.info("[Sentra] Ollama model already present: %s", OLLAMA_MODEL)

    return _OllamaClient(OLLAMA_MODEL, OLLAMA_BASE_URL), None


def _load_accelerated(model_id: str):
    """Load model using Unsloth FastLanguageModel (4-bit quantised, GPU only)."""
    from unsloth import FastLanguageModel  # optional dependency

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_id,
        max_seq_length=2048,
        load_in_4bit=True,
        dtype=None,
    )
    FastLanguageModel.for_inference(model)
    _clear_stale_generation_flags(model)
    return model, tokenizer


def get_cached_model(inference_mode: str, model_id: str):
    """Return (model, tokenizer) from cache, loading on first call per mode."""
    logger.info("[Sentra] get_cached_model called with inference_mode='%s'", inference_mode)
    if inference_mode not in _MODEL_CACHE:
        if inference_mode == "accelerated":
            if not _cuda_available():
                logger.warning(
                    "[Sentra] Accelerated mode requires CUDA — none detected. "
                    "Falling back to GGUF mode."
                )
                inference_mode = "gguf"
            else:
                try:
                    logger.info("[Sentra] Loading model in Accelerated mode (Unsloth 4-bit)...")
                    _MODEL_CACHE["accelerated"] = _load_accelerated(model_id)
                    logger.info("[Sentra] Accelerated model loaded.")
                except ImportError:
                    logger.warning("[Sentra] Unsloth not installed; falling back to GGUF.")
                    inference_mode = "gguf"

        if inference_mode == "gguf":
            # Try llama-cpp-python first, then Ollama, then standard.
            try:
                logger.info("[Sentra] Trying llama-cpp-python...")
                _MODEL_CACHE["gguf"] = _load_gguf(model_id)
                logger.info("[Sentra] GGUF model loaded via llama-cpp-python.")
            except ImportError:
                logger.warning("[Sentra] llama-cpp-python not installed. Trying Ollama...")
                try:
                    _MODEL_CACHE["gguf"] = _load_ollama(model_id)
                    logger.info("[Sentra] GGUF model loaded via Ollama.")
                except Exception as e:
                    logger.warning(
                        "[Sentra] Ollama failed (%s: %s). "
                        "Falling back to Standard mode. "
                        "Install Ollama for faster inference: https://ollama.com/download",
                        type(e).__name__, e,
                    )
                    inference_mode = "standard"
            except Exception as e:
                logger.warning(
                    "[Sentra] GGUF load failed (%s); falling back to Standard mode.", e
                )
                inference_mode = "standard"

        if inference_mode == "standard" and "standard" not in _MODEL_CACHE:
            logger.info(
                "[Sentra] Loading model in Standard mode (bfloat16 + adapter) "
                "— this takes 2-5 min on first load..."
            )
            _MODEL_CACHE["standard"] = _load_standard(model_id)
            logger.info("[Sentra] Standard model loaded.")

    return _MODEL_CACHE.get(inference_mode) or _MODEL_CACHE["standard"]


class DetectorAgentEntity(BaseEntity):
    """Entity for Detector Agent — manages model state and configuration."""

    MODEL_ID = "duyle240820/sentra-utoledo-v2.0"

    def __init__(self, inference_mode: str = "gguf"):
        super().__init__()
        self.inference_mode = inference_mode
        self.model, self.tokenizer = get_cached_model(inference_mode, self.MODEL_ID)
        self.system_prompt = get_system_prompt_detector()
