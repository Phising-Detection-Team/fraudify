"""
Stats and agent info API endpoints.

GET /api/stats  - Aggregated dashboard statistics
GET /api/agents - List of known agents with live usage stats
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.models import db, Round, Email, API as APICall

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

    total_emails_scanned = db.session.query(
        func.coalesce(func.sum(Round.processed_emails), 0)
    ).scalar()

    threats_detected = db.session.query(func.count(Email.id)).filter(
        Email.detector_verdict == 'phishing'
    ).scalar()

    return jsonify({
        'success': True,
        'data': {
            'total_api_cost': round(float(total_api_cost), 6),
            'active_agents': 2,
            'total_emails_scanned': int(total_emails_scanned),
            'threats_detected': int(threats_detected),
        },
    }), 200


@stats_bp.route('/stats/costs', methods=['GET'])
@jwt_required()
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
