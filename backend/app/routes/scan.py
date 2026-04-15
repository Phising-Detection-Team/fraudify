"""Scan routes: /api/scan/*

POST /api/scan                  — Submit an email for synchronous phishing analysis
GET  /api/scan/status/<job_id>  — Legacy: poll the status of an async scan task
GET  /api/scan/history          — Get the current user's scan history
GET  /api/scan/admin/recent     — Admin: paginated list of all user scans

Architecture note
-----------------
POST /api/scan runs detection SYNCHRONOUSLY (1–5 s) so the browser extension
never needs to poll. The response always contains `status: 'complete'` with the
verdict, eliminating the Celery reliability issue that caused the banner to be
stuck in "Analyzing..." state.

The /api/scan/status endpoint is kept for backward compatibility but is no longer
the primary code path for new scans.
"""

from celery.result import AsyncResult
from concurrent.futures import ThreadPoolExecutor
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload

from app import limiter
from app.cache import get_scan_cache, set_scan_cache, get_vt_quota
from app.models import db, User
from app.models.user_scan import UserScan
from app.utils import require_role
from app.utils.prompts import build_safe_email_prompt
from app.tasks.scan_tasks import (
    _run_detector_sync,
    _normalize_verdict,
    _run_virustotal_sync,
)

scan_bp = Blueprint('scan', __name__)

MAX_BODY_BYTES = 50 * 1024    # 50 KB
MAX_SUBJECT_BYTES = 1024      # 1 KB


# ---------------------------------------------------------------------------
# POST /api/scan  — enqueue async task
# ---------------------------------------------------------------------------

@scan_bp.route('/scan', methods=['POST'])
@jwt_required()
@limiter.limit('100 per hour', key_func=get_jwt_identity)
def scan_email():
    """
    Analyse an email for phishing.

    Runs detection synchronously (1–5 s) and always returns a complete verdict.
    Cache hits return immediately. New emails block until the AI model responds.

    Body (JSON):
        subject  (str, optional): email subject line
        body     (str, required): email body text

    Returns 200 with data.status='complete' and verdict/confidence/reasoning.
    """
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    body_json = request.get_json(silent=True) or {}
    if not body_json:
        return jsonify({'success': False, 'error': 'Request body must be valid JSON'}), 400

    subject = body_json.get('subject', '').strip()
    body_text = body_json.get('body', '').strip()
    links = body_json.get('links', [])

    if not body_text:
        return jsonify({'success': False, 'error': 'body is required'}), 400

    if len(body_text.encode('utf-8')) > MAX_BODY_BYTES:
        return jsonify({'success': False, 'error': 'Email body too large. Maximum size is 50KB.'}), 400

    if len(subject.encode('utf-8')) > MAX_SUBJECT_BYTES:
        return jsonify({'success': False, 'error': 'Email subject too large. Maximum size is 1KB.'}), 400

    if not isinstance(links, list):
        links = []
    
    # Optional logic: we can append the raw links to the body text to ensure
    # the LLM actually 'sees' the structural URL for typosquatting checks
    body_text_for_llm = body_text
    if links:
        body_text_for_llm += f"\n\n[Extracted Links for Analysis: {', '.join(links)}]"

    # Cache lookup — return immediately if we've seen this exact content before
    cached = get_scan_cache(subject, body_text_for_llm)
    if cached:
        # Still persist to UserScan so the hit appears in history and threat intelligence
        try:
            scan_record = UserScan(
                user_id=user.id,
                subject=subject or None,
                body_snippet=(body_text[:200] if body_text else None),
                full_body=body_text,
                verdict=cached.get('verdict', 'suspicious'),
                confidence=cached.get('confidence'),
                scam_score=cached.get('scam_score'),
                reasoning=cached.get('reasoning'),
            )
            db.session.add(scan_record)
            db.session.commit()
        except Exception:
            current_app.logger.exception('Failed to persist UserScan for user %s', user.id)
            db.session.rollback()
        return jsonify({
            'success': True,
            'data': {**cached, 'cached': True, 'status': 'complete'},
        }), 200

    # Cache miss — run detection synchronously (1–5 s AI call).
    # This guarantees the extension always receives `status: 'complete'` in a
    # single response, removing the need for status polling and any dependency
    # on the Celery worker being alive.
    
    email_content = build_safe_email_prompt(subject, body_text_for_llm)

    # Dynamic calculation for VT quota limits based on active user count
    total_users = max(1, User.query.filter_by(is_active=True).count())
    vt_max_scans = max(1, 500 // total_users)

    try:
        # Run AI detection and VirusTotal URL checks in parallel
        with ThreadPoolExecutor(max_workers=2) as executor:
            detector_future = executor.submit(_run_detector_sync, email_content)
            vt_future = executor.submit(
                _run_virustotal_sync,
                urls=links,
                user_id=user.id,
                max_scans=vt_max_scans
            )

            # Wait for results (timeout on vt to prevent blocking)
            try:
                vt_malicious_urls = vt_future.result(timeout=10)
            except Exception as e:
                current_app.logger.warning(f"VT parallel execution error/timeout: {str(e)}")
                vt_malicious_urls = []

            # Wait for AI model
            parsed = detector_future.result(timeout=45)

    except Exception:
        current_app.logger.exception("Detection failed")
        return jsonify({'success': False, 'error': 'Detection service unavailable. Please try again.'}), 503

    if not parsed:
        return jsonify({'success': False, 'error': 'Detector returned invalid response'}), 500

    confidence = float(parsed.get('confidence', 0.0))
    scam_score = float(parsed.get('scam_score', 0.0)) if parsed.get('scam_score') is not None else 0.0
    reasoning = str(parsed.get('reasoning', ''))

    # Override verdict if VirusTotal flagged any link
    verdict = _normalize_verdict(parsed.get('verdict', ''))
    if vt_malicious_urls:
        verdict = 'phishing'
        confidence = 1.0
        scam_score = 10.0
        reasoning = f"[🚨 VIRUSTOTAL DETERMINISTIC DETECTION] Malicious link(s) found in email: {', '.join(vt_malicious_urls)}\n\n" + reasoning

    # Normalise confidence to 0-1 range (detector may return 0-100)
    if confidence > 1:
        confidence = confidence / 100.0

    result = {
        'status': 'complete',
        'verdict': verdict,
        'confidence': confidence,
        'scam_score': scam_score,
        'reasoning': reasoning,
    }

    # Persist to content-addressed scan cache for instant repeat lookups
    ttl = current_app.config.get('SCAN_CACHE_TTL', 3600)
    set_scan_cache(subject, body_text_for_llm, result, ttl=ttl)

    # Persist scan result to the UserScan table for history and admin views
    try:
        scan_record = UserScan(
            user_id=user.id,
            subject=subject or None,
            body_snippet=(body_text[:200] if body_text else None),
            full_body=body_text_for_llm,
            verdict=result['verdict'],
            confidence=result['confidence'],
            scam_score=result['scam_score'],
            reasoning=result['reasoning'],
        )
        db.session.add(scan_record)
        db.session.commit()
    except Exception:
        current_app.logger.exception('Failed to persist UserScan for user %s', user.id)
        db.session.rollback()
        # DB write failure must not fail the scan response

    return jsonify({'success': True, 'data': result}), 200


# ---------------------------------------------------------------------------
# GET /api/scan/status/<job_id>  — poll task result
# ---------------------------------------------------------------------------

@scan_bp.route('/scan/status/<job_id>', methods=['GET'])
@jwt_required()
def get_scan_status(job_id: str):
    """
    Poll the status of an async scan task.

    Returns:
        status  (str): 'pending' | 'complete' | 'failed'
        verdict, confidence, scam_score, reasoning when complete

    On any unexpected error (e.g. Celery/Redis unavailable) returns 200 with
    status='pending' so the content-script poller keeps running without
    triggering a CORS-blocked 500 that removes the banner.
    """
    try:
        result = AsyncResult(job_id)

        if result.state in ('PENDING', 'STARTED'):
            return jsonify({'success': True, 'data': {'status': 'pending'}}), 200

        if result.state == 'SUCCESS':
            return jsonify({'success': True, 'data': result.result}), 200

        # FAILURE or other terminal state
        current_app.logger.error('Scan task %s failed: %s', job_id, result.info)
        return jsonify({
            'success': True,
            'data': {
                'status': 'failed',
                'error': 'Scan task failed. Please try again.',
            },
        }), 200
    except Exception as exc:
        current_app.logger.error('Error fetching scan status for %s: %s', job_id, exc)
        return jsonify({'success': True, 'data': {'status': 'pending'}}), 200


# ---------------------------------------------------------------------------
# GET /api/scan/history
# ---------------------------------------------------------------------------

@scan_bp.route('/scan/history', methods=['GET'])
@jwt_required()
@limiter.exempt
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

    scans = [s.to_dict(include_full_body=True) for s in pagination.items]

    return jsonify({
        'success': True,
        'scans': scans,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/scan/admin/recent  — admin view of all user scans
# ---------------------------------------------------------------------------

@scan_bp.route('/scan/admin/recent', methods=['GET'])
@jwt_required()
@limiter.exempt
def admin_recent_scans():
    """
    Return a paginated list of all user-submitted scans for admins.

    Query params:
        page     (int, default 1)
        per_page (int, default 20, max 100)

    Returns rows with full_body and user_email included (not in to_dict()).
    Requires admin or super_admin role.
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid pagination parameters'}), 400

    pagination = (
        UserScan.query
        .options(joinedload(UserScan.user))
        .order_by(UserScan.scanned_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    scans = []
    for scan in pagination.items:
        user_email = scan.user.email if scan.user else 'unknown'
        scans.append({
            'id': scan.id,
            'user_id': scan.user_id,
            'user_email': user_email,
            'subject': scan.subject,
            'body_snippet': scan.body_snippet,
            'full_body': scan.full_body,
            'verdict': scan.verdict,
            'confidence': scan.confidence,
            'scam_score': scan.scam_score,
            'reasoning': scan.reasoning,
            'scanned_at': scan.scanned_at.isoformat() if scan.scanned_at else None,
        })

    return jsonify({
        'success': True,
        'scans': scans,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200

# ---------------------------------------------------------------------------
# POST /api/scan/url  — manual URL scan
# ---------------------------------------------------------------------------

@scan_bp.route('/scan/url', methods=['POST'])
@jwt_required()
@limiter.limit('200 per hour', key_func=get_jwt_identity)
def scan_manual_url():
    """
    Analyse a single URL manually submitted by the user.
    Uses VT + LLM to judge context and typosquatting.
    """
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    body_json = request.get_json(silent=True) or {}
    url = body_json.get('url', '').strip()
    
    if not url:
        return jsonify({'success': False, 'error': 'url is required'}), 400

    # Avoid caching manually injected prompts by normalising cache keys on just the URL
    cached = get_scan_cache("URL Scan", url)
    if cached:
        # We need to record history
        try:
            scan_record = UserScan(
                user_id=user.id,
                subject="Manual URL Scan",
                body_snippet=url[:200],
                full_body=url,
                verdict=cached.get('verdict', 'suspicious'),
                confidence=cached.get('confidence'),
                scam_score=cached.get('scam_score'),
                reasoning=cached.get('reasoning'),
            )
            db.session.add(scan_record)
            db.session.commit()
        except Exception:
            db.session.rollback()
            
        return jsonify({'success': True, 'data': {**cached, 'cached': True, 'status': 'complete'}}), 200

    total_users = max(1, User.query.filter_by(is_active=True).count())
    vt_max_scans = max(1, 500 // total_users)
    
    email_content_mock = build_safe_email_prompt(
        "Website Risk Assessment",
        f"The user is visiting the following URL: {url}\nPlease analyse this domain and path for typosquatting, suspicious patterns, or brand impersonation."
    )

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            detector_future = executor.submit(_run_detector_sync, email_content_mock)
            vt_future = executor.submit(_run_virustotal_sync, urls=[url], user_id=user.id, max_scans=vt_max_scans)

            try:
                vt_malicious_urls = vt_future.result(timeout=10)
            except Exception:
                vt_malicious_urls = []

            parsed = detector_future.result(timeout=45)
    except Exception:
        current_app.logger.exception("URL detection failed")
        return jsonify({'success': False, 'error': 'Detection service unavailable.'}), 503

    if not parsed:
        return jsonify({'success': False, 'error': 'Detector returned invalid response'}), 500

    confidence = float(parsed.get('confidence', 0.0))
    scam_score = float(parsed.get('scam_score', 0.0)) if parsed.get('scam_score') is not None else 0.0
    reasoning = str(parsed.get('reasoning', ''))

    verdict = _normalize_verdict(parsed.get('verdict', ''))
    if vt_malicious_urls:
        verdict = 'phishing'
        confidence = 1.0
        scam_score = 10.0
        reasoning = f"[🚨 VIRUSTOTAL DETERMINISTIC DETECTION] Known malicious URL flagged by engines.\n\n" + reasoning

    if confidence > 1:
        confidence = confidence / 100.0

    result = {
        'status': 'complete',
        'verdict': verdict,
        'confidence': confidence,
        'scam_score': scam_score,
        'reasoning': reasoning,
    }

    set_scan_cache("URL Scan", url, result, ttl=3600)
    
    try:
        scan_record = UserScan(
            user_id=user.id,
            subject="Manual URL Scan",
            body_snippet=url[:200],
            full_body=url,
            verdict=result['verdict'],
            confidence=result['confidence'],
            scam_score=result['scam_score'],
            reasoning=result['reasoning'],
        )
        db.session.add(scan_record)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({'success': True, 'data': result}), 200

@scan_bp.route('/scan/quota', methods=['GET'])
@jwt_required()
def get_user_quota():
    """
    Get the VT detection quota for the current user and the global system.
    """
    user_id = get_jwt_identity()

    # Dynamic calculation for VT quota limits based on active user count
    total_users = max(1, User.query.filter_by(is_active=True).count())
    vt_max_scans = max(1, 500 // total_users)

    quota = get_vt_quota(user_id, vt_max_scans)
    
    return jsonify({'success': True, 'data': quota}), 200
