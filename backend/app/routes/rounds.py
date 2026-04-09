"""
Round management API endpoints.

POST /api/rounds          - Start a new competition round
GET  /api/rounds          - List rounds with pagination and filters
GET  /api/rounds/<id>     - Get a single round with metrics
POST /api/rounds/<id>/run - Trigger AI orchestration for a round
"""

import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required
from sqlalchemy import desc, asc

from app.models import db, Round
from app.errors import ValidationError, NotFoundError, ConflictError
from app.utils import paginate, require_role
from app.tasks.round_tasks import run_round_task

rounds_bp = Blueprint('rounds', __name__)

SORTABLE_FIELDS = {
    'id': Round.id,
    'started_at': Round.started_at,
    'completed_at': Round.completed_at,
    'total_emails': Round.total_emails,
    'detector_accuracy': Round.detector_accuracy,
    'total_cost': Round.total_cost,
}


@rounds_bp.route('/rounds', methods=['POST'])
@jwt_required()
def create_round():
    """
    Start a new competition round.

    Body (JSON):
        total_emails  (int, required): number of emails to process
        created_by    (str, optional): who initiated the round
        notes         (str, optional): freeform notes

    Returns 201 with the new round object.
    Raises 400 on invalid input, 409 if a round is already running.
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError('Request body must be valid JSON')

    total_emails = data.get('total_emails')
    if total_emails is None:
        raise ValidationError('total_emails is required')
    try:
        total_emails = int(total_emails)
        if total_emails <= 0:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError('total_emails must be a positive integer')

    running = Round.query.filter_by(status='running').first()
    if running:
        raise ConflictError(
            f'Round {running.id} is already running. '
            'Wait for it to complete or mark it as failed before starting a new one.'
        )

    new_round = Round(
        status='running',
        total_emails=total_emails,
        processed_emails=0,
        started_at=datetime.now(timezone.utc),
        created_by=data.get('created_by'),
        notes=data.get('notes'),
    )

    db.session.add(new_round)
    db.session.commit()

    return jsonify({
        'success': True,
        'data': new_round.to_dict()
    }), 201


@rounds_bp.route('/rounds', methods=['GET'])
@jwt_required()
def list_rounds():
    """
    List rounds with pagination, filtering, and sorting.

    Query params:
        status    (str): filter by status (pending, running, completed, failed)
        created_by (str): filter by creator
        sort_by   (str): field to sort on (default: started_at)
        order     (str): 'asc' or 'desc' (default: desc)
        page      (int): page number (default: 1)
        per_page  (int): items per page (default: 20, max: 100)
    """
    query = Round.query

    status = request.args.get('status')
    if status:
        allowed = {'pending', 'running', 'completed', 'failed'}
        if status not in allowed:
            raise ValidationError(f'status must be one of {allowed}')
        query = query.filter_by(status=status)

    created_by = request.args.get('created_by')
    if created_by:
        query = query.filter_by(created_by=created_by)

    sort_field_name = request.args.get('sort_by', 'started_at')
    sort_column = SORTABLE_FIELDS.get(sort_field_name, Round.started_at)
    order = request.args.get('order', 'desc')
    if order == 'asc':
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    result = paginate(query)
    return jsonify({'success': True, **result}), 200


@rounds_bp.route('/rounds/<int:round_id>', methods=['GET'])
@jwt_required()
def get_round(round_id):
    """
    Get a single round by ID with computed metrics.

    Returns 200 with round data + email_count + live accuracy.
    Raises 404 if round not found.
    """
    round_obj = db.session.get(Round, round_id)
    if not round_obj:
        raise NotFoundError(f'Round {round_id} not found')

    data = round_obj.to_dict()
    data['email_count'] = round_obj.emails.count()
    data['live_accuracy'] = round_obj.calculate_accuracy()

    return jsonify({'success': True, 'data': data}), 200


@rounds_bp.route('/rounds/<int:round_id>/run', methods=['POST'])
@jwt_required()
def run_round(round_id):
    """
    Trigger OpenAI Agents SDK orchestration (Gemini generator + Claude detector) for a round.

    The pipeline runs in a background thread. Poll GET /api/rounds/<id>
    to track progress (processed_emails, status).

    Optional JSON body:
        parallel_workflows (int): defaults to ORCHESTRATION_PARALLEL_WORKFLOWS or 2

    Returns 202 Accepted immediately.
    Raises 404 if round not found, 409 if round is not in 'running' state,
    400 if required API keys are missing.
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    round_obj = db.session.get(Round, round_id)
    if not round_obj:
        raise NotFoundError(f'Round {round_id} not found')

    if round_obj.status != 'running':
        raise ConflictError(
            f'Round {round_id} has status "{round_obj.status}". '
            'Only rounds with status "running" can be executed.'
        )

    anthropic = os.environ.get('ANTHROPIC_API_KEY')
    google = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
    if not google or not anthropic:
        raise ValidationError(
            'GOOGLE_API_KEY (or GEMINI_API_KEY) and ANTHROPIC_API_KEY must be set '
            'for OpenAI Agents orchestration.'
        )

    data = request.get_json(silent=True) or {}
    workflows = data.get('parallel_workflows', current_app.config.get('ORCHESTRATION_PARALLEL_WORKFLOWS', 2))
    try:
        workflows = int(workflows)
        if workflows < 1:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError('parallel_workflows must be a positive integer')

    run_round_task.delay(round_id, round_obj.total_emails, workflows)

    return jsonify({
        'success': True,
        'message': (
            f'OpenAI Agents orchestration started for round {round_id} '
            f'({round_obj.total_emails} emails, {workflows} parallel workflows)'
        ),
        'data': round_obj.to_dict(),
    }), 202
