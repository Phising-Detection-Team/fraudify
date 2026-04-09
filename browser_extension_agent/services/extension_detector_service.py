import json
import logging
import re
import time
import types

from services.base_service import BaseService
from entities.extension_detector_entity import ExtensionDetectorEntity
from utils.prompts import build_safe_email_prompt, ALLOWED_VERDICTS, FALLBACK_VERDICT

logger = logging.getLogger(__name__)

# Basic injection keywords to block pre-flight
_INJECTION_KEYWORDS_RE = re.compile(
    r"(ignore previous instructions|system prompt|you are now|forget all instructions|override rules)", 
    re.IGNORECASE
)

class ExtensionDetectorService(BaseService):
    """Service for the browser extension's local phishing detector (Ollama/Sentra)."""

    # Phishing signals appear in subject/greeting/body/CTA — 2000 chars captures
    # all key indicators while keeping input tokens under ~500 (fits num_ctx=1024).
    _MAX_EMAIL_CHARS = 2000

    def __init__(self):
        super().__init__()
        self.entity = ExtensionDetectorEntity()

    async def analyze_email(self, email_content: str):
        """Runs the local Sentra model on an email via Ollama and returns a result namespace."""
        if _INJECTION_KEYWORDS_RE.search(email_content):
            logger.warning("[Sentra/Extension] Prompt injection keywords detected in pre-flight! Passing to fine-tuned model for evaluation.")

        if len(email_content) > self._MAX_EMAIL_CHARS:
            email_content = email_content[:self._MAX_EMAIL_CHARS]
            logger.debug(
                "[Sentra/Extension] Email truncated to %d chars for inference.",
                self._MAX_EMAIL_CHARS,
            )

        safe_prompt = build_safe_email_prompt(email_content)

        logger.info("[Sentra/Extension] GGUF inference starting...")
        t0 = time.perf_counter()
        response = self.entity.model.create_chat_completion(
            messages=[
                {"role": "system", "content": self.entity.system_prompt},
                {"role": "user",   "content": safe_prompt},
            ],
            max_tokens=-1,   # unlimited — generate until stop token, bounded by num_ctx
            temperature=0.7,
        )
        logger.info(
            "[Sentra/Extension] GGUF inference done in %.1fs", time.perf_counter() - t0
        )
        output_text = response["choices"][0]["message"]["content"]
        logger.info("[Sentra/Extension] Raw output: %s", output_text)
        
        # Post-flight Output Validation
        try:
            parsed = json.loads(output_text)
            verdict = parsed.get("verdict")
            confidence = float(parsed.get("confidence", 0.0))
            
            if verdict not in ALLOWED_VERDICTS:
                parsed["verdict"] = FALLBACK_VERDICT # Failsafe default
            elif verdict == "LEGITIMATE":
                reasoning = parsed.get("reasoning", "").strip()
                # If model says LEGITIMATE but fails to provide meaningful reasoning (often happens during manipulation bypasses)
                if not reasoning or len(reasoning) < 10:
                    logger.warning("[Sentra/Extension] Model returned LEGITIMATE with missing/insufficient reasoning. Flagging as %s.", FALLBACK_VERDICT)
                    parsed["verdict"] = FALLBACK_VERDICT
            
            if not (0.0 <= confidence <= 1.0):
                parsed["confidence"] = max(0.0, min(1.0, confidence)) # Clamp
                
            output_text = json.dumps(parsed)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error("[Sentra/Extension] Invalid JSON response from model: %s", e)
            output_text = json.dumps({
                "verdict": FALLBACK_VERDICT,
                "confidence": 0.0,
                "scam_score": 50,
                "reasoning": "Model returned malformed response format."
            })
            
        return types.SimpleNamespace(final_output=output_text)
