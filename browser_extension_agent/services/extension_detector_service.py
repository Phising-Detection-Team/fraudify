import base64
import json
import logging
import re
import time
import types

from services.base_service import BaseService
from entities.extension_detector_entity import ExtensionDetectorEntity
from utils.prompts import wrap_email_content

logger = logging.getLogger(__name__)


# ─── Pre-flight injection detection patterns ──────────────────────────────────

# Category A: Role/system directive tokens — block immediately
_CAT_A_SYSTEM_DIRECTIVE = re.compile(
    r'\[SYSTEM\]|\[INST\]|\[\/INST\]|<system>|<\/system>|<<SYS>>|'
    r'<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>',
    re.IGNORECASE,
)

# Category B: Instruction override language — block immediately
_CAT_B_INSTRUCTION_OVERRIDE = re.compile(
    r'ignore\s+(all\s+|previous\s+|your\s+)?instructions|'
    r'forget\s+(your\s+|all\s+)?instructions|'
    r'override\s+\S*\s*instructions|'
    r'disregard\s+\S*\s*instructions|'
    r'new\s+(system\s+)?prompt|'
    r'your\s+(new\s+)?instructions\s+(are|:)|'
    r'ADMIN\s+OVERRIDE|'
    r'CRITICAL\s+SYSTEM\s+DIRECTIVE',
    re.IGNORECASE,
)

# Category C: Jailbreak / persona hijack — block immediately
_CAT_C_JAILBREAK = re.compile(
    r'\bDAN\b|developer\s+mode|jailbreak|unrestricted\s+mode|'
    r'you\s+are\s+now\s+\w|act\s+as\s+(an?\s+)?\w+|pretend\s+(to\s+be|you\s+are)|'
    r'roleplay\s+as|in\s+this\s+scenario\s+you\s+are|'
    r'from\s+now\s+on\s+(you\s+|respond\s+)',
    re.IGNORECASE,
)

# Category D: Model-level boundary tokens — sanitize, don't block
_CAT_D_BOUNDARY_TOKENS = re.compile(
    r'###\s*(System|User|Assistant)|'
    r'(Human|Assistant)\s*:\s*\n|'
    r'<\/?(prompt|context|input)>',
    re.IGNORECASE,
)

# Category E: Template / code injection — sanitize, don't block
_CAT_E_TEMPLATE = re.compile(r'\{\{.*?\}\}|\$\{.*?\}|<%.*?%>|#\{.*?\}', re.DOTALL)

# Category F: Long base64 strings that may encode blocked patterns
_CAT_F_BASE64 = re.compile(r'[A-Za-z0-9+/]{20,}={0,2}')

_BLOCK_CATEGORIES = (
    ("system directive token",     _CAT_A_SYSTEM_DIRECTIVE),
    ("instruction override",       _CAT_B_INSTRUCTION_OVERRIDE),
    ("jailbreak / persona hijack", _CAT_C_JAILBREAK),
)


class ExtensionDetectorService(BaseService):
    """Service for the browser extension's local phishing detector (Ollama/Sentra)."""

    # Phishing signals appear in subject/greeting/body/CTA — 2000 chars captures
    # all key indicators while keeping input tokens under ~500 (fits num_ctx=1024).
    _MAX_EMAIL_CHARS = 2000

    def __init__(self):
        super().__init__()
        self.entity = ExtensionDetectorEntity()

    @staticmethod
    def _preflight_check(email_content: str) -> tuple:
        """
        Scan email content for prompt injection patterns before sending to the LLM.

        Checks six injection categories:
          A — Role/system directive tokens     (block)
          B — Instruction override language    (block)
          C — Jailbreak / persona hijack       (block)
          D — Model-level boundary tokens      (sanitize)
          E — Template / code injection        (sanitize)
          F — Base64-encoded blocked payload   (block)

        Returns:
            (block_response, sanitized_content, injection_sanitized)
            - block_response:      dict to return immediately if injection detected, else None
            - sanitized_content:   email text after stripping Cat D/E tokens
            - injection_sanitized: True if Cat D/E tokens were stripped
        """
        # Categories A, B, C — hard block
        for category_name, pattern in _BLOCK_CATEGORIES:
            if pattern.search(email_content):
                logger.warning(
                    "[Sentra/Preflight] Injection blocked (%s): %.120s",
                    category_name,
                    email_content,
                )
                return (
                    {
                        "verdict": "SCAM",
                        "confidence": 0.99,
                        "scam_score": 99.0,
                        "reasoning": (
                            f"Prompt injection attempt detected ({category_name}). "
                            "Email contains directives designed to override security analysis."
                        ),
                    },
                    email_content,
                    False,
                )

        # Category F — base64-encoded payload check
        for match in _CAT_F_BASE64.finditer(email_content):
            try:
                decoded = base64.b64decode(match.group() + "==").decode("utf-8", errors="ignore")
                for category_name, pattern in _BLOCK_CATEGORIES:
                    if pattern.search(decoded):
                        logger.warning(
                            "[Sentra/Preflight] Base64 injection blocked (%s).", category_name
                        )
                        return (
                            {
                                "verdict": "SCAM",
                                "confidence": 0.99,
                                "scam_score": 99.0,
                                "reasoning": (
                                    "Prompt injection attempt detected (base64-encoded payload). "
                                    "Email contains obfuscated directives designed to bypass security filters."
                                ),
                            },
                            email_content,
                            False,
                        )
            except Exception:  # noqa: BLE001
                pass

        # Categories D & E — sanitize, don't block
        injection_sanitized = False
        sanitized = email_content
        if _CAT_D_BOUNDARY_TOKENS.search(sanitized):
            sanitized = _CAT_D_BOUNDARY_TOKENS.sub("", sanitized).strip()
            injection_sanitized = True
            logger.info("[Sentra/Preflight] Category D boundary tokens stripped.")
        if _CAT_E_TEMPLATE.search(sanitized):
            sanitized = _CAT_E_TEMPLATE.sub("", sanitized).strip()
            injection_sanitized = True
            logger.info("[Sentra/Preflight] Category E template expressions stripped.")

        return None, sanitized, injection_sanitized

    async def analyze_email(self, email_content: str):
        """Runs the local Sentra model on an email via Ollama and returns a result namespace."""
        if len(email_content) > self._MAX_EMAIL_CHARS:
            email_content = email_content[:self._MAX_EMAIL_CHARS]
            logger.debug(
                "[Sentra/Extension] Email truncated to %d chars for inference.",
                self._MAX_EMAIL_CHARS,
            )

        # Pre-flight prompt injection check before the content ever reaches the LLM.
        block_response, email_content, injection_sanitized = self._preflight_check(email_content)
        if block_response is not None:
            return types.SimpleNamespace(final_output=json.dumps(block_response))

        if injection_sanitized:
            logger.info("[Sentra/Extension] Email content sanitized (Cat D/E tokens stripped).")

        logger.info("[Sentra/Extension] GGUF inference starting...")
        t0 = time.perf_counter()
        response = self.entity.model.create_chat_completion(
            messages=[
                {"role": "system", "content": self.entity.system_prompt},
                {"role": "user",   "content": wrap_email_content(email_content.strip())},
            ],
            max_tokens=-1,   # unlimited — generate until stop token, bounded by num_ctx
            temperature=0.3,
        )
        logger.info(
            "[Sentra/Extension] GGUF inference done in %.1fs", time.perf_counter() - t0
        )
        output_text = response["choices"][0]["message"]["content"]
        logger.info("[Sentra/Extension] Raw output: %s", output_text)

        result = types.SimpleNamespace(final_output=output_text)
        if injection_sanitized:
            result.injection_sanitized = True
        return result
