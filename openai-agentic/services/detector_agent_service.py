import logging
import time
import types
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.prompts import get_detection_prompt

logger = logging.getLogger(__name__)


class DetectorAgentService(BaseService):
    """Service for executing the Detector Entity."""

    def __init__(self):
        super().__init__()
        self.entity = DetectorAgentEntity()

    # Phishing signals appear in subject/greeting/body/CTA — 2000 chars captures
    # all key indicators while keeping input tokens under ~500 (fits num_ctx=1024).
    _MAX_EMAIL_CHARS = 2000

    async def analyze_email(self, email_content: str):
        """Runs local phishing detection model on an email via Ollama."""
        if len(email_content) > self._MAX_EMAIL_CHARS:
            email_content = email_content[:self._MAX_EMAIL_CHARS]
            logger.debug("[Sentra] Email truncated to %d chars for inference.", self._MAX_EMAIL_CHARS)

        logger.info("[Sentra] GGUF inference starting...")
        t0 = time.perf_counter()
        response = self.entity.model.create_chat_completion(
            messages=[
                {"role": "system", "content": self.entity.system_prompt},
                {"role": "user",   "content": get_detection_prompt(email_content)},
            ],
            max_tokens=-1,   # unlimited — generate until stop token, bounded by num_ctx
            temperature=0.7,
        )
        logger.info("[Sentra] GGUF inference done in %.1fs", time.perf_counter() - t0)
        output_text = response["choices"][0]["message"]["content"]
        logger.info("[Sentra] Raw output: %s", output_text)
        return types.SimpleNamespace(final_output=output_text)
