import logging
import time
import types
import torch
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.prompts import get_detection_prompt

logger = logging.getLogger(__name__)


class DetectorAgentService(BaseService):
    """Service for executing the Detector Entity."""

    def __init__(self, inference_mode: str = "gguf"):
        super().__init__()
        self.entity = DetectorAgentEntity(inference_mode=inference_mode)

    # Phishing signals appear in subject/greeting/body/CTA — 4000 chars (~1000 words)
    # is sufficient. Longer inputs slow down CPU inference significantly.
    _MAX_EMAIL_CHARS = 4000

    async def analyze_email(self, email_content: str):
        """Runs local phishing detection model on an email."""
        if len(email_content) > self._MAX_EMAIL_CHARS:
            email_content = email_content[:self._MAX_EMAIL_CHARS]
            logger.debug("[Sentra] Email truncated to %d chars for inference.", self._MAX_EMAIL_CHARS)
        user_content = get_detection_prompt(email_content)
        system_prompt = self.entity.system_prompt

        mode = self.entity.inference_mode

        # ── GGUF path (llama_cpp handles tokenization internally) ──────────────
        if mode == "gguf" or self.entity.tokenizer is None:
            llm = self.entity.model
            logger.info("[Sentra] GGUF inference starting...")
            t0 = time.perf_counter()
            response = llm.create_chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_content},
                ],
                max_tokens=80,
                temperature=0.7,
            )
            logger.info("[Sentra] GGUF inference done in %.1fs", time.perf_counter() - t0)
            output_text = response["choices"][0]["message"]["content"]
            logger.info("[Sentra] Raw output: %s", output_text)
            return types.SimpleNamespace(final_output=output_text)

        # ── Transformers path (Standard / Accelerated) ─────────────────────────
        tokenizer = self.entity.tokenizer
        model = self.entity.model

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ]

        if hasattr(tokenizer, "apply_chat_template"):
            text = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
        else:
            text = f"{system_prompt}\n\n{user_content}"

        device = getattr(model, "device", next(model.parameters()).device)
        inputs = tokenizer(text, return_tensors="pt").to(device)

        logger.info("[Sentra] Standard inference starting (device=%s)...", device)
        t0 = time.perf_counter()
        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=80,
                do_sample=True,
                temperature=0.7,
                pad_token_id=tokenizer.eos_token_id,
            )
        logger.info("[Sentra] Standard inference done in %.1fs", time.perf_counter() - t0)

        new_ids = output_ids[0][inputs["input_ids"].shape[1]:]
        output_text = tokenizer.decode(new_ids, skip_special_tokens=True)
        return types.SimpleNamespace(final_output=output_text)
