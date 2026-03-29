"""Scan routes: /api/scan/*

POST /api/scan          — Submit an email for phishing analysis
GET  /api/scan/history  — Get the current user's scan history
"""

import asyncio
import json
import os
import sys
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models import db, User
from app.models.user_scan import UserScan

scan_bp = Blueprint('scan', __name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


def _ensure_agentic_on_path() -> None:
    root = _project_root()
    oa_dir = os.path.join(root, 'openai-agentic')
    if root not in sys.path:
        sys.path.insert(0, root)
    if oa_dir not in sys.path:
        sys.path.insert(0, oa_dir)


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


_VERDICT_MAP = {
    'scam': 'phishing',
    'likely scam': 'likely_phishing',
    'suspicious': 'suspicious',
    'likely legitimate': 'likely_legitimate',
    'legitimate': 'legitimate',
}


def _normalize_verdict(raw: str) -> str:
    return _VERDICT_MAP.get(raw.lower().strip(), 'suspicious')


async def _run_detector(email_content: str) -> dict:
    """Call DetectorAgentService asynchronously and return parsed JSON result."""
    _ensure_agentic_on_path()
    from services.detector_agent_service import DetectorAgentService  # noqa: PLC0415

    svc = DetectorAgentService()
    result = await svc.analyze_email(email_content)
    parsed = _parse_json_output(result.final_output)
    if not parsed:
        raise ValueError('Detector returned invalid JSON')
    return parsed


# ---------------------------------------------------------------------------
# POST /api/scan
# ---------------------------------------------------------------------------

@scan_bp.route('/scan', methods=['POST'])
@jwt_required()
def scan_email():
    """
    Analyse an email for phishing.

    Body (JSON):
        subject  (str, optional): email subject line
        body     (str, required): email body text

    Returns:
        JSON with verdict, confidence, scam_score, reasoning, and scan id.
    """
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    body_json = request.get_json(silent=True) or {}
    subject = body_json.get('subject', '').strip()
    body_text = body_json.get('body', '').strip()

    if not body_text:
        return jsonify({'success': False, 'error': 'body is required'}), 400

    email_content = f"Subject: {subject}\n\n{body_text}" if subject else body_text

    try:
        detection = asyncio.run(_run_detector(email_content))
    except Exception as exc:
        current_app.logger.error('Scan error for user %s: %s', identity, exc)
        return jsonify({'success': False, 'error': 'Detection service unavailable. Please try again later.'}), 503

    verdict_raw = detection.get('verdict', 'suspicious')
    confidence = detection.get('confidence', 0.0)
    scam_score = detection.get('scam_score', 0.0)
    reasoning = detection.get('reasoning', '')

    # Normalise confidence to 0-1 range (detector may return 0-100)
    if isinstance(confidence, (int, float)) and confidence > 1:
        confidence = confidence / 100.0

    scan = UserScan(
        user_id=user.id,
        subject=subject or None,
        body_snippet=body_text[:500],
        full_body=body_text,
        verdict=_normalize_verdict(verdict_raw),
        confidence=confidence,
        scam_score=scam_score,
        reasoning=reasoning,
        scanned_at=datetime.utcnow(),
    )
    db.session.add(scan)
    db.session.commit()

    return jsonify({
        'success': True,
        'id': scan.id,
        'verdict': scan.verdict,
        'verdict_label': verdict_raw,
        'confidence': scan.confidence,
        'scam_score': scan.scam_score,
        'reasoning': scan.reasoning,
        'scanned_at': scan.scanned_at.isoformat(),
    }), 201


# ---------------------------------------------------------------------------
# GET /api/scan/history
# ---------------------------------------------------------------------------

@scan_bp.route('/scan/history', methods=['GET'])
@jwt_required()
def scan_history():
    """
    Retrieve the current user's scan history (paginated).

    Query params:
        page     (int, default 1)
        per_page (int, default 20, max 100)
    """
    identity = get_jwt_identity()

    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid pagination parameters'}), 400

    pagination = (
        UserScan.query
        .filter_by(user_id=int(identity))
        .order_by(UserScan.scanned_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        'success': True,
        'scans': [s.to_dict() for s in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200
