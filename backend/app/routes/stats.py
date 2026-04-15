"""
Stats and agent info API endpoints.

GET /api/stats               - Aggregated dashboard statistics (admin)
GET /api/stats/me            - Per-user scan statistics (current user only)
GET /api/stats/costs         - Cost breakdown by agent/model
GET /api/stats/intelligence  - Threat intelligence panel data
GET /api/agents              - List of known agents with live usage stats
"""

from collections import Counter

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, case

from app.models import db, Round, Email, API as APICall, User
from app.models.user_scan import UserScan
from app.utils import require_role
from app import limiter
from app.cache import get_vt_quota

stats_bp = Blueprint('stats', __name__)

_AGENTS = [
    {
        'id': 'generator',
        'name': 'Generator',
        'type': 'generator',
        'model': 'gemini/gemini-2.0-flash',
        'status': 'active',
    },
    {
        'id': 'detector',
        'name': 'Detector',
        'type': 'detector',
        'model': 'anthropic/claude-3-5-haiku',
        'status': 'active',
    },
]


@stats_bp.route('/stats', methods=['GET'])
@jwt_required()
@limiter.exempt
def get_stats():
    """
    Return aggregated statistics for the admin dashboard.

    Returns:
        total_api_cost:        sum of all API call costs
        active_agents:         number of known agents (2)
        total_emails_scanned:  sum of processed_emails across all rounds
        threats_detected:      count of emails where detector_verdict = 'phishing'
    """
    total_api_cost = db.session.query(
        func.coalesce(func.sum(APICall.cost), 0)
    ).scalar()

    # Round-based emails (generator/detector pipeline)
    round_emails_scanned = db.session.query(
        func.coalesce(func.sum(Round.processed_emails), 0)
    ).scalar()

    round_threats_detected = db.session.query(func.count(Email.id)).filter(
        Email.detector_verdict == 'phishing'
    ).scalar()

    # User-submitted extension scans
    user_scans_total = db.session.query(func.count(UserScan.id)).scalar()

    user_threats_detected = db.session.query(func.count(UserScan.id)).filter(
        UserScan.verdict.in_(['phishing', 'likely_phishing'])
    ).scalar()

    total_users = max(1, User.query.filter_by(is_active=True).count())
    vt_max_scans = max(1, 500 // total_users)
    vt_quota = get_vt_quota(0, vt_max_scans)

    return jsonify({
        'success': True,
        'data': {
            'total_api_cost': round(float(total_api_cost), 6),
            'active_agents': len(_AGENTS),
            'total_emails_scanned': int(round_emails_scanned) + int(user_scans_total),
            'threats_detected': int(round_threats_detected) + int(user_threats_detected),
            'global_vt_limit': vt_quota['global_limit'],
            'global_vt_used': vt_quota['global_used'],
            'global_vt_remaining': vt_quota['global_remaining'],
        },
    }), 200


@stats_bp.route('/stats/me', methods=['GET'])
@jwt_required()
@limiter.exempt
def get_my_stats():
    """
    Return scan statistics scoped to the currently authenticated user.

    Returns:
        total_emails_scanned:  number of emails this user has scanned via the extension
        threats_detected:      count of this user's scans with verdict phishing/likely_phishing
        marked_safe:           count of this user's scans with verdict legitimate/likely_legitimate
    """
    user_id = get_jwt_identity()

    emails_scanned = db.session.query(func.count(UserScan.id)).filter(
        UserScan.user_id == user_id
    ).scalar()

    threats_detected = db.session.query(func.count(UserScan.id)).filter(
        UserScan.user_id == user_id,
        UserScan.verdict.in_(['phishing', 'likely_phishing']),
    ).scalar()

    marked_safe = db.session.query(func.count(UserScan.id)).filter(
        UserScan.user_id == user_id,
        UserScan.verdict.in_(['legitimate', 'likely_legitimate']),
    ).scalar()

    return jsonify({
        'success': True,
        'data': {
            'total_emails_scanned': int(emails_scanned),
            'threats_detected': int(threats_detected),
            'marked_safe': int(marked_safe),
        },
    }), 200


@stats_bp.route('/stats/costs', methods=['GET'])
@jwt_required()
@limiter.exempt
def get_cost_breakdown():
    """
    Return API cost breakdown grouped by agent type and model.

    Returns items suitable for a pie chart, along with totals.
    """
    rows = (
        db.session.query(
            APICall.agent_type,
            APICall.model_name,
            func.count(APICall.id).label('calls'),
            func.coalesce(func.sum(APICall.token_used), 0).label('tokens'),
            func.coalesce(func.sum(APICall.cost), 0).label('cost'),
        )
        .group_by(APICall.agent_type, APICall.model_name)
        .order_by(APICall.agent_type)
        .all()
    )

    items = [
        {
            'agent_type': row.agent_type,
            'model_name': row.model_name or 'unknown',
            'calls': row.calls,
            'tokens': int(row.tokens),
            'cost': round(float(row.cost), 6),
        }
        for row in rows
    ]
    total = round(sum(r['cost'] for r in items), 6)

    return jsonify({'success': True, 'items': items, 'total': total}), 200


@stats_bp.route('/agents', methods=['GET'])
@jwt_required()
@limiter.exempt
def get_agents():
    """
    Return the two known agents enriched with live API-call stats.

    Each agent includes:
        call_count, total_tokens, total_cost, last_active (ISO timestamp or null)
    """
    rows = (
        db.session.query(
            APICall.agent_type,
            func.count(APICall.id).label('call_count'),
            func.coalesce(func.sum(APICall.token_used), 0).label('total_tokens'),
            func.coalesce(func.sum(APICall.cost), 0).label('total_cost'),
            func.max(APICall.created_at).label('last_active'),
        )
        .group_by(APICall.agent_type)
        .all()
    )
    stats_by_type = {
        row.agent_type: {
            'call_count': row.call_count,
            'total_tokens': int(row.total_tokens),
            'total_cost': round(float(row.total_cost), 6),
            'last_active': row.last_active.isoformat() if row.last_active else None,
        }
        for row in rows
    }

    agents = []
    for agent in _AGENTS:
        live = stats_by_type.get(agent['type'], {
            'call_count': 0,
            'total_tokens': 0,
            'total_cost': 0.0,
            'last_active': None,
        })
        agents.append({**agent, **live})

    return jsonify({'success': True, 'data': agents}), 200


# ---------------------------------------------------------------------------
# Threat Intelligence
# ---------------------------------------------------------------------------

_STOPWORDS = frozenset({
    'the', 'a', 'an', 'is', 'in', 'to', 'of', 'and', 'or', 'for',
    'on', 'at', 'by', 'be', 'it', 'as', 'are', 'was', 'were', 'not',
    'this', 'that', 'with', 'from', 'your', 'you', 'we', 'our', 'has',
    'have', 'had', 'will', 'can', 'all', 'its', 'but', 'do', 'if',
    'no', 'so', 'up', 'out', 'into',
})

_CONFIDENCE_BUCKETS = [
    ('0-20%',  0.0,  0.2),
    ('20-40%', 0.2,  0.4),
    ('40-60%', 0.4,  0.6),
    ('60-80%', 0.6,  0.8),
    ('80-100%', 0.8, 1.001),  # include exactly 1.0
]


@stats_bp.route('/stats/intelligence', methods=['GET'])
@jwt_required()
@limiter.exempt
def get_intelligence():
    """
    Return threat intelligence data for the admin panel.

    Requires admin or super_admin role.

    Returns:
        confidence_distribution: Email + UserScan counts grouped into 5 confidence buckets
        accuracy_over_rounds:    Per-round detector accuracy (correct / total) — pipeline only
        fp_fn_rates:             Per-round FP/FN rates — pipeline only (needs ground-truth label)
        top_phishing_words:      Top-20 words from phishing subjects (pipeline + extension scans)
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    # -- 1. Confidence distribution ----------------------------------------
    # Merge pipeline Email confidence with extension UserScan confidence values
    pipeline_confidences = (
        db.session.query(Email.detector_confidence)
        .filter(Email.detector_confidence.isnot(None))
        .all()
    )
    extension_confidences = (
        db.session.query(UserScan.confidence)
        .filter(UserScan.confidence.isnot(None))
        .all()
    )

    bucket_counts: dict[str, int] = {label: 0 for label, _, _ in _CONFIDENCE_BUCKETS}
    for confidences in (pipeline_confidences, extension_confidences):
        for (conf,) in confidences:
            for label, lo, hi in _CONFIDENCE_BUCKETS:
                if lo <= conf < hi:
                    bucket_counts[label] += 1
                    break

    confidence_distribution = [
        {'bucket': label, 'count': bucket_counts[label]}
        for label, _, _ in _CONFIDENCE_BUCKETS
    ]

    # -- 2. Accuracy over rounds (pipeline only — requires ground-truth label) --
    completed_rounds = (
        db.session.query(Round)
        .filter(Round.status == 'completed')
        .order_by(Round.id)
        .all()
    )

    accuracy_over_rounds = []
    fp_fn_rates = []

    for rnd in completed_rounds:
        emails = rnd.emails.all()
        total = len(emails)
        if total == 0:
            continue

        # A prediction is "correct" when detector_verdict matches is_phishing ground truth
        correct = sum(
            1 for e in emails
            if (e.is_phishing and e.detector_verdict == 'phishing') or
               (not e.is_phishing and e.detector_verdict == 'legitimate')
        )
        accuracy = correct / total

        accuracy_over_rounds.append({
            'round_id': rnd.id,
            'accuracy': round(accuracy, 4),
            'completed_at': rnd.completed_at.isoformat() if rnd.completed_at else None,
        })

        # FP: predicted phishing but actually legitimate
        actual_legitimate = [e for e in emails if not e.is_phishing]
        fp_count = sum(1 for e in actual_legitimate if e.detector_verdict == 'phishing')
        fp_rate = fp_count / len(actual_legitimate) if actual_legitimate else 0.0

        # FN: predicted legitimate but actually phishing
        actual_phishing = [e for e in emails if e.is_phishing]
        fn_count = sum(1 for e in actual_phishing if e.detector_verdict == 'legitimate')
        fn_rate = fn_count / len(actual_phishing) if actual_phishing else 0.0

        fp_fn_rates.append({
            'round_id': rnd.id,
            'false_positive_rate': round(fp_rate, 4),
            'false_negative_rate': round(fn_rate, 4),
        })

    # -- 3. Top phishing words (pipeline + extension scans) ----------------
    pipeline_subjects = (
        db.session.query(Email.generated_subject)
        .filter(
            Email.detector_verdict == 'phishing',
            Email.generated_subject.isnot(None),
        )
        .all()
    )
    extension_subjects = (
        db.session.query(UserScan.subject)
        .filter(
            UserScan.verdict.in_(['phishing', 'likely_phishing']),
            UserScan.subject.isnot(None),
        )
        .all()
    )

    word_counter: Counter[str] = Counter()
    for subjects in (pipeline_subjects, extension_subjects):
        for (subject,) in subjects:
            tokens = subject.lower().split()
            for token in tokens:
                # Strip punctuation at boundaries
                clean = token.strip('.,!?;:\'"()[]{}')
                if clean and clean not in _STOPWORDS and len(clean) > 1:
                    word_counter[clean] += 1

    top_phishing_words = [
        {'word': word, 'count': count}
        for word, count in word_counter.most_common(20)
    ]

    return jsonify({
        'success': True,
        'data': {
            'confidence_distribution': confidence_distribution,
            'accuracy_over_rounds': accuracy_over_rounds,
            'fp_fn_rates': fp_fn_rates,
            'top_phishing_words': top_phishing_words,
        },
    }), 200


# ---------------------------------------------------------------------------
# Cache stats (Sprint 7 — R6)
# ---------------------------------------------------------------------------

@stats_bp.route('/stats/cache', methods=['GET'])
@jwt_required()
@limiter.exempt
def cache_stats():
    """
    Return scan result cache statistics.

    Requires admin or super_admin role.

    Returns:
        cached_keys  (int):  number of active cache entries
        available    (bool): True when Redis is reachable
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    from app.cache import get_cache_stats
    stats = get_cache_stats()
    return jsonify({'success': True, 'data': stats}), 200
