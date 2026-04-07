import json
import logging
import re
import time
import types
import torch
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.prompts import get_detection_prompt

logger = logging.getLogger(__name__)


def _generate_specific_reasoning(email_content: str, verdict: str, scam_score: float) -> str:
    """
    Replace the model's hardcoded template reasoning with signals extracted from
    the actual email content.

    The fine-tuned GGUF model always outputs one of two fixed reasoning strings
    regardless of input (a training-data collapse artifact).  This function reads
    the email and returns a sentence that references concrete evidence found in it.
    """
    content_lower = email_content.lower()

    # ── Extract subject line ──────────────────────────────────────────────────
    subject = ""
    for line in email_content.split("\n")[:10]:
        stripped = line.strip()
        if stripped.lower().startswith("subject:"):
            subject = stripped[8:].strip()[:80]
            break

    is_scam = verdict.upper() == "SCAM" or scam_score >= 70

    # ── SCAM path: find a concrete suspicious signal ──────────────────────────
    if is_scam:
        # Ordered from most specific/damning to most generic
        suspicious_patterns = [
            r"(?:verify|confirm|update)\s+(?:your\s+)?(?:account|password|credentials|payment\s+details|billing\s+info)",
            r"(?:click\s+here|tap\s+here)\s+(?:to\s+)?(?:verify|confirm|secure|restore|reset)",
            r"(?:act\s+now|respond\s+immediately|urgent(?:ly)?|action\s+required)",
            r"(?:account\s+(?:suspended|locked|limited|compromised|deactivated))",
            r"(?:gift\s+card|wire\s+transfer|crypto(?:currency)?|bitcoin|send\s+money)",
            r"(?:you\s+(?:have\s+)?(?:won|been\s+selected)|congratulations[^.]{0,40}(?:prize|reward|winner))",
            r"(?:limited[-\s]time\s+offer|expires?\s+(?:in|on|at)\s+\d)",
            r"(?:unusual\s+(?:sign[-\s]in|activity|login)|suspicious\s+(?:access|activity))",
        ]
        for pattern in suspicious_patterns:
            m = re.search(pattern, content_lower)
            if m:
                start = max(0, m.start() - 10)
                end = min(len(email_content), m.end() + 40)
                snippet = email_content[start:end].strip().replace("\n", " ")
                return (
                    f'Contains suspicious phrase: "{snippet}" — '
                    f"indicates possible attempt to manipulate the recipient."
                )

        if subject:
            return (
                f'Subject "{subject}" combined with the email\'s content '
                f"patterns raised phishing classification flags."
            )
        return "Email body language patterns are associated with phishing attempts."

    # ── LEGITIMATE path: find a concrete trustworthy signal ───────────────────
    legit_signals: list[str] = []

    # Known brand/sender references
    brand_map = {
        r"\bgoogle\b": "Google",
        r"\brobinhood\b": "Robinhood",
        r"\b(?:intuit|turbo\s*tax)\b": "Intuit/TurboTax",
        r"\bamazon\b": "Amazon",
        r"\bmicrosoft\b": "Microsoft",
        r"\bgithub\b": "GitHub",
        r"\bapple\b": "Apple",
        r"\bweight[s]?\s*(?:&|and)\s*bias(?:es)?\b": "Weights & Biases",
        r"\beducative\b": "Educative",
        r"\bcredit\s*karma\b": "Credit Karma",
        r"\bpaypal\b": "PayPal",
        r"\bstripe\b": "Stripe",
        r"\budemy\b": "Udemy",
    }
    for pattern, brand in brand_map.items():
        if re.search(pattern, content_lower):
            legit_signals.append(f"identified sender: {brand}")
            break

    # Physical mailing address
    addr_m = re.search(
        r"\d{3,5}\s+\w[\w\s]{3,30}(?:street|st\.?|avenue|ave\.?|road|rd\.?|blvd|way|place|pl\.?)",
        content_lower,
    )
    if addr_m:
        snippet = email_content[addr_m.start(): addr_m.start() + 60].strip().replace("\n", " ")
        legit_signals.append(f'includes physical address ("{snippet}")')

    # Unsubscribe / email-preferences link
    if re.search(r"unsubscribe|opt.?out|email\s+preferences", content_lower):
        legit_signals.append("contains proper unsubscribe option")

    # Personalised greeting with a name
    name_m = re.search(r"(?:hi|hello|hey|dear)\s+([\w\s]{2,30}),", email_content, re.IGNORECASE)
    if name_m:
        legit_signals.append(f'personally addressed to "{name_m.group(1).strip()}"')

    # Order/reference number
    ref_m = re.search(r"(?:order|case|ref(?:erence)?|ticket)\s*(?:#|no\.?)?\s*([A-Z0-9\-]{5,})",
                      email_content, re.IGNORECASE)
    if ref_m:
        legit_signals.append(f"references {ref_m.group(0).strip()}")

    if legit_signals:
        return "Appears legitimate: " + "; ".join(legit_signals[:2]) + "."

    if subject:
        return (
            f'Subject "{subject}" is consistent with routine account or service '
            f"communication; no credential requests detected."
        )
    return "Standard business communication with no phishing indicators detected."


def _override_reasoning(raw_json: str, email_content: str) -> str:
    """
    Parse the model's JSON output, replace the reasoning with an email-specific
    one, and return the updated JSON string.  Falls back to the original string
    on any parse error.
    """
    try:
        parsed = json.loads(raw_json)
        verdict = str(parsed.get("verdict", ""))
        scam_score = float(parsed.get("scam_score", 0))
        parsed["reasoning"] = _generate_specific_reasoning(email_content, verdict, scam_score)
        return json.dumps(parsed)
    except Exception:
        return raw_json  # never break the scan on a post-processing failure


class DetectorAgentService(BaseService):
    """Service for executing the Detector Entity."""

    def __init__(self, inference_mode: str = "gguf"):
        super().__init__()
        self.entity = DetectorAgentEntity(inference_mode=inference_mode)

    # Phishing signals appear in subject/greeting/body/CTA — 2000 chars captures
    # all key indicators while keeping input tokens under ~500 (fits num_ctx=1024).
    _MAX_EMAIL_CHARS = 2000

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
            raw_output = response["choices"][0]["message"]["content"]
            logger.info("[Sentra] Raw model output: %s", raw_output)

            # Replace the model's hardcoded template reasoning with email-specific text.
            output_text = _override_reasoning(raw_output, email_content)
            if output_text != raw_output:
                logger.info("[Sentra] Reasoning overridden: %s", output_text)

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
        raw_output = tokenizer.decode(new_ids, skip_special_tokens=True)
        output_text = _override_reasoning(raw_output, email_content)
        return types.SimpleNamespace(final_output=output_text)
