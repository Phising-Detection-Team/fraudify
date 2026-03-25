"""
Cost analytics API endpoints.

GET /api/costs - Aggregated cost breakdown by agent type, round, and model
"""

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import db, Round, API as APICall
from app.errors import ValidationError

costs_bp = Blueprint('costs', __name__)


@costs_bp.route('/costs', methods=['GET'])
def get_costs():
    """
    Get cost breakdown with optional round filter.

    Query params:
        round_id (int): restrict to a single round

    Returns:
        total_cost:      overall sum
        by_agent:        [{agent_type, total_cost, total_tokens, call_count}]
        by_round:        [{round_id, total_cost, total_tokens, call_count}]  (top 20)
        by_model:        [{model_name, total_cost, total_tokens, call_count}]
        avg_cost_per_email: average cost across all emails
    """
    base_query = db.session.query(APICall)

    round_id = request.args.get('round_id')
    if round_id is not None:
        try:
            round_id = int(round_id)
        except (TypeError, ValueError):
            raise ValidationError('round_id must be an integer')
        base_query = base_query.filter(APICall.round_id == round_id)

    # Total cost
    total_cost = base_query.with_entities(
        func.coalesce(func.sum(APICall.cost), 0)
    ).scalar()

    total_tokens = base_query.with_entities(
        func.coalesce(func.sum(APICall.token_used), 0)
    ).scalar()

    total_calls = base_query.count()

    # Breakdown by agent type
    by_agent_rows = (
        base_query.with_entities(
            APICall.agent_type,
            func.coalesce(func.sum(APICall.cost), 0).label('total_cost'),
            func.coalesce(func.sum(APICall.token_used), 0).label('total_tokens'),
            func.count(APICall.id).label('call_count'),
        )
        .group_by(APICall.agent_type)
        .all()
    )
    by_agent = [
        {
            'agent_type': row.agent_type,
            'total_cost': round(float(row.total_cost), 6),
            'total_tokens': int(row.total_tokens),
            'call_count': row.call_count,
        }
        for row in by_agent_rows
    ]

    # Breakdown by round (top 20 most expensive)
    by_round_rows = (
        base_query.with_entities(
            APICall.round_id,
            func.coalesce(func.sum(APICall.cost), 0).label('total_cost'),
            func.coalesce(func.sum(APICall.token_used), 0).label('total_tokens'),
            func.count(APICall.id).label('call_count'),
        )
        .group_by(APICall.round_id)
        .order_by(func.sum(APICall.cost).desc())
        .limit(20)
        .all()
    )
    by_round = [
        {
            'round_id': row.round_id,
            'total_cost': round(float(row.total_cost), 6),
            'total_tokens': int(row.total_tokens),
            'call_count': row.call_count,
        }
        for row in by_round_rows
    ]

    # Breakdown by model
    by_model_rows = (
        base_query.with_entities(
            APICall.model_name,
            func.coalesce(func.sum(APICall.cost), 0).label('total_cost'),
            func.coalesce(func.sum(APICall.token_used), 0).label('total_tokens'),
            func.count(APICall.id).label('call_count'),
        )
        .group_by(APICall.model_name)
        .all()
    )
    by_model = [
        {
            'model_name': row.model_name,
            'total_cost': round(float(row.total_cost), 6),
            'total_tokens': int(row.total_tokens),
            'call_count': row.call_count,
        }
        for row in by_model_rows
    ]

    # Average cost per email (from rounds table)
    round_query = db.session.query(Round)
    if round_id is not None:
        round_query = round_query.filter(Round.id == round_id)

    total_emails_processed = round_query.with_entities(
        func.coalesce(func.sum(Round.processed_emails), 0)
    ).scalar()

    avg_cost_per_email = (
        round(float(total_cost) / int(total_emails_processed), 6)
        if total_emails_processed
        else 0
    )

    return jsonify({
        'success': True,
        'data': {
            'total_cost': round(float(total_cost), 6),
            'total_tokens': int(total_tokens),
            'total_api_calls': total_calls,
            'avg_cost_per_email': avg_cost_per_email,
            'by_agent': by_agent,
            'by_round': by_round,
            'by_model': by_model,
        }
    }), 200
