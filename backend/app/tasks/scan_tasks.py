"""
Celery tasks for email phishing detection.

scan_email_task: Asynchronously runs the DetectorAgentService on an email and
returns a normalised verdict dict.
"""

import asyncio
import json
import os
import sys

from flask import current_app

from app import celery
from app.cache import set_scan_cache


# ---------------------------------------------------------------------------
# Verdict normalisation (mirrors scan route logic)
# ---------------------------------------------------------------------------

_VERDICT_MAP = {
    'scam': 'phishing',
    'likely scam': 'likely_phishing',
    'suspicious': 'suspicious',
    'likely legitimate': 'likely_legitimate',
    'legitimate': 'legitimate',
}


def _normalize_verdict(raw: str) -> str:
    return _VERDICT_MAP.get(raw.lower().strip(), 'suspicious')


def _parse_json_output(text: str) -> dict | None:
    """Extract JSON from model output, tolerating markdown wrappers."""
    if not text:
        return None
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines and lines[-1].strip() == '```' else lines[1:])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    return None


def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


def _ensure_agentic_on_path() -> None:
    root = _project_root()
    oa_dir = os.path.join(root, 'openai-agentic')
    if root not in sys.path:
        sys.path.insert(0, root)
    if oa_dir not in sys.path:
        sys.path.insert(0, oa_dir)


def _run_detector_sync(email_content: str, inference_mode: str = "standard") -> dict | None:
    """Run DetectorAgentService synchronously and return parsed result dict."""
    _ensure_agentic_on_path()
    from services.detector_agent_service import DetectorAgentService  # noqa: PLC0415

    async def _detect() -> dict | None:
        svc = DetectorAgentService(inference_mode=inference_mode)
        result = await svc.analyze_email(email_content)
        return _parse_json_output(result.final_output)

    return asyncio.run(_detect())


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

@celery.task(bind=True, name='tasks.scan_email')
def scan_email_task(self, user_id: int, subject: str, body: str, inference_mode: str = "standard") -> dict:
    """
    Run phishing detection asynchronously.

    Returns a dict with:
        status      str   'complete'
        verdict     str   normalised verdict (phishing, likely_phishing, etc.)
        confidence  float 0-1 range
        scam_score  float
        reasoning   str
    """
    self.update_state(state='STARTED', meta={'status': 'analyzing'})

    email_content = f"Subject: {subject}\n\n{body}" if subject else body
    parsed = _run_detector_sync(email_content, inference_mode=inference_mode)

    if not parsed:
        raise ValueError('Detector returned invalid or empty JSON')

    verdict_raw = parsed.get('verdict', 'suspicious')
    confidence = parsed.get('confidence', 0.0)
    scam_score = parsed.get('scam_score', 0.0)
    reasoning = parsed.get('reasoning', '')

    # Raised thresholds to reduce false positives
    def _score_to_verdict(scam_score: float) -> str:
        if scam_score >= 85:    return 'phishing'         # was 80
        if scam_score >= 70:    return 'likely_phishing'  # was 60
        if scam_score >= 50:    return 'suspicious'       # was 40
        if scam_score >= 25:    return 'likely_legitimate' # was 20
        return 'legitimate'

    # Normalise confidence to 0-1 range (detector may return 0-100)
    if isinstance(confidence, (int, float)) and confidence > 1:
        confidence = confidence / 100.0

    result = {
        'status': 'complete',
        'verdict': _score_to_verdict(scam_score) if 'scam_score' in parsed else _normalize_verdict(verdict_raw),
        'confidence': confidence,
        'scam_score': scam_score,
        'reasoning': reasoning,
    }

    ttl = current_app.config.get('SCAN_CACHE_TTL', 3600)
    set_scan_cache(subject, body, result, ttl=ttl)

    return result
