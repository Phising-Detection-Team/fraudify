import logging
import os

from dotenv import load_dotenv

from entities.base_entity import BaseEntity
from utils.prompts import get_system_prompt

load_dotenv()

logger = logging.getLogger(__name__)

# Module-level singleton: loaded once per process on first use.
_MODEL_CACHE: dict = {}

OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "hf.co/duyle240820/sentra-utoledo-v2.0")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


class _OllamaClient:
    """Minimal wrapper around Ollama's OpenAI-compatible endpoint."""

    def __init__(self, model: str, base_url: str):
        self.model = model
        self.base_url = base_url.rstrip("/")

    def create_chat_completion(self, messages, max_tokens=128, temperature=0.0, **_):
        import requests
        resp = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
                "format": "json",   # Ollama-native JSON mode (forces valid JSON output)
                # Cap KV cache to 1024 tokens — enough for a 2000-char email + system
                # prompt + ~80-token output.
                "options": {"num_ctx": 1024},
            },
            timeout=300,
        )
        resp.raise_for_status()
        return resp.json()


def _load_ollama(_model_id: str):
    """
    Initialise Ollama backend.

    1. Verify Ollama is running.
    2. Pull the model (no-op if already up-to-date; picks up retrained model
       pushes automatically on next backend restart).
    3. Return an _OllamaClient.
    """
    import requests

    try:
        requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
    except Exception:
        raise RuntimeError(
            "Ollama server is not running. "
            "Start it with:  ollama serve  (or launch the Ollama desktop app)."
        )

    logger.info(
        "[Sentra/Extension] Pulling '%s' via Ollama (no-op if already up-to-date)...",
        OLLAMA_MODEL,
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
    logger.info("[Sentra/Extension] Ollama model ready: %s", OLLAMA_MODEL)

    return _OllamaClient(OLLAMA_MODEL, OLLAMA_BASE_URL), None


def get_cached_model(model_id: str):
    """Return the cached _OllamaClient, loading it on first call."""
    if "ollama" not in _MODEL_CACHE:
        logger.info("[Sentra/Extension] Loading model via Ollama...")
        _MODEL_CACHE["ollama"] = _load_ollama(model_id)
        logger.info("[Sentra/Extension] Model loaded via Ollama.")
    return _MODEL_CACHE["ollama"]


class ExtensionDetectorEntity(BaseEntity):
    """Entity for the browser extension's local phishing detector (Ollama/Sentra)."""

    MODEL_ID = "duyle240820/sentra-utoledo-v2.0"

    def __init__(self):
        super().__init__()
        self.model, self.tokenizer = get_cached_model(self.MODEL_ID)
        self.system_prompt = get_system_prompt()
