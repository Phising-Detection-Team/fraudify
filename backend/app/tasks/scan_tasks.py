"""
Celery tasks for email phishing detection.

scan_email_task: Asynchronously runs the DetectorAgentService on an email and
returns a normalised verdict dict.
"""

import asyncio
import json
import os
import sys
import requests

from flask import current_app

from app import celery
from app.cache import set_scan_cache, get_vt_cache, set_vt_cache, track_and_check_vt_quota


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
    return _VERDICT_MAP.get(raw.lower().strip(), 'likely_legitimate')


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


def _ensure_extension_on_path() -> None:
    """Add browser_extension_agent/ to sys.path so flat imports resolve correctly."""
    root = _project_root()
    ext_dir = os.path.join(root, 'browser_extension_agent')
    if ext_dir not in sys.path:
        sys.path.insert(0, ext_dir)


def _run_detector_sync(email_content: str) -> dict | None:
    """Run ExtensionDetectorService synchronously and return parsed result dict."""
    _ensure_extension_on_path()
    from services.extension_detector_service import ExtensionDetectorService  # noqa: PLC0415

    async def _detect() -> dict | None:
        svc = ExtensionDetectorService()
        result = await svc.analyze_email(email_content)
        return _parse_json_output(result.final_output)

    return asyncio.run(_detect())


# ---------------------------------------------------------------------------
# VirusTotal integration
# ---------------------------------------------------------------------------

def _run_virustotal_sync(urls: list[str], user_id: int, max_scans: int) -> list[str]:
    """
    Run VirusTotal scans on a list of URLs synchronously.
    Returns a list of URLs that are detected as malicious.
    """
    if not urls:
        return []
        
    malicious_urls = []
    vt_api_key = os.environ.get('VT_API_KEY')
    if not vt_api_key:
        return []
        
    # Deduplicate
    unique_urls = list(set(urls))
    
    for url in unique_urls:
        # Check cache first (saves quota and latency)
        cached = get_vt_cache(url)
        if cached is not None:
            if cached.get('malicious', False):
                malicious_urls.append(url)
            continue
            
        # Verify quota for API call
        if not track_and_check_vt_quota(user_id, max_scans):
            current_app.logger.warning(f"VT Quota exceeded for user {user_id}")
            # If quota exceeded, we skip this and remaining uncached URLs
            break
            
        try:
            # We must use the v3 API: POST to /urls, then GET the analysis ID
            headers = {"x-apikey": vt_api_key}
            encoded_url = requests.utils.quote(url, safe='')
            
            # To save latency for synchronous calls, we'll try fetching the report directly if it exists,
            # this works for most common phishing links.
            # Using v3 GET /urls/{url_id} where url_id is base64url(url)
            import base64
            url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
            
            resp = requests.get(f"https://www.virustotal.com/api/v3/urls/{url_id}", headers=headers, timeout=5)
            if resp.status_code == 200:
                stats = resp.json().get('data', {}).get('attributes', {}).get('last_analysis_stats', {})
                malicious = stats.get('malicious', 0)
                suspicious = stats.get('suspicious', 0)
                is_malicious = (malicious + suspicious) > 0
                
                # Cache result
                set_vt_cache(url, {"malicious": is_malicious})
                if is_malicious:
                    malicious_urls.append(url)
        except Exception as e:
            current_app.logger.error(f"VirusTotal API error: {str(e)}")
            continue

    return malicious_urls


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

@celery.task(bind=True, name='tasks.scan_email')
def scan_email_task(self, user_id: int, subject: str, body: str) -> dict:
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
    parsed = _run_detector_sync(email_content)

    if not parsed:
        raise ValueError('Detector returned invalid or empty JSON')

    confidence = parsed.get('confidence', 0.0)
    scam_score = parsed.get('scam_score', 0.0)
    reasoning = parsed.get('reasoning', '')

    # Normalise confidence to 0-1 range (detector may return 0-100)
    if isinstance(confidence, (int, float)) and confidence > 1:
        confidence = confidence / 100.0

    result = {
        'status': 'complete',
        'verdict': _normalize_verdict(parsed.get('verdict', '')),
        'confidence': confidence,
        'scam_score': scam_score,
        'reasoning': reasoning,
    }

    ttl = current_app.config.get('SCAN_CACHE_TTL', 3600)
    set_scan_cache(subject, body, result, ttl=ttl)

    return result
