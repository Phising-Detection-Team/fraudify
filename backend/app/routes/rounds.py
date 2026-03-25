"""
Round management API endpoints.

POST /api/rounds          - Start a new competition round
GET  /api/rounds          - List rounds with pagination and filters
GET  /api/rounds/<id>     - Get a single round with metrics
POST /api/rounds/<id>/run - Trigger AI orchestration for a round
"""

import asyncio
import threading
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import desc, asc

from app.models import db, Round, Email
from app.errors import ValidationError, NotFoundError, ConflictError
from app.utils import paginate

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


def _run_orchestration(app, round_id, total_emails):
    """Background worker that runs the AI orchestration pipeline.

    Runs in a separate thread so it doesn't block the Flask request.
    Creates its own app context since threads don't inherit it.
    """
    with app.app_context():
        kernel = app.config.get('SK_KERNEL')
        if not kernel:
            round_obj = db.session.get(Round, round_id)
            if round_obj:
                round_obj.status = 'failed'
                round_obj.completed_at = datetime.now(timezone.utc)
                db.session.commit()
            return

        orchestration_plugin = kernel.get_plugin('orchestration')

        start_time = datetime.now(timezone.utc)
        processed = 0

        for i in range(1, total_emails + 1):
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(
                    orchestration_plugin['ai_orchestrate'].invoke(
                        kernel=kernel,
                        round_id=round_id,
                    )
                )
                loop.close()

                email_result = result.value if result else None
                if email_result and isinstance(email_result, dict):
                    generated_content = email_result.get('generated_content') or '[Generation failed]'

                    raw_verdict = str(email_result.get('detection_verdict', '')).upper()
                    if any(w in raw_verdict for w in ['SCAM', 'PHISHING', 'SUSPICIOUS', 'FRAUD']):
                        detector_verdict = 'phishing'
                    else:
                        detector_verdict = 'legitimate'

                    confidence = email_result.get('detection_confidence')
                    if confidence is not None:
                        confidence = max(0.0, min(1.0, float(confidence)))

                    email_record = Email(
                        round_id=round_id,
                        generated_content=generated_content,
                        generated_prompt=email_result.get('generated_prompt'),
                        generated_subject=email_result.get('generated_subject'),
                        generated_body=email_result.get('generated_body'),
                        is_phishing=email_result.get('is_phishing', True),
                        generated_email_metadata=email_result.get('generated_email_metadata', {}),
                        generator_latency_ms=email_result.get('generated_latency_ms'),
                        detector_verdict=detector_verdict,
                        detector_risk_score=email_result.get('detection_risk_score'),
                        detector_confidence=confidence,
                        detector_reasoning=email_result.get('detection_reasoning'),
                        detector_latency_ms=email_result.get('detector_latency_ms'),
                        cost=email_result.get('cost', 0.0),
                        created_at=datetime.now(timezone.utc),
                    )
                    db.session.add(email_record)
                    processed += 1

            except Exception as e:
                current_app.logger.error(f'Orchestration email {i}/{total_emails} failed: {e}')

            round_obj = db.session.get(Round, round_id)
            if round_obj:
                round_obj.processed_emails = processed
                db.session.commit()

        end_time = datetime.now(timezone.utc)
        round_obj = db.session.get(Round, round_id)
        if round_obj:
            round_obj.status = 'completed'
            round_obj.completed_at = end_time
            round_obj.processed_emails = processed
            round_obj.processing_time = int((end_time - start_time).total_seconds())
            round_obj.detector_accuracy = round_obj.calculate_accuracy()
            db.session.commit()


@rounds_bp.route('/rounds/<int:round_id>/run', methods=['POST'])
def run_round(round_id):
    """
    Trigger AI orchestration for an existing round.

    The pipeline runs in a background thread. Poll GET /api/rounds/<id>
    to track progress (processed_emails, status).

    Returns 202 Accepted immediately.
    Raises 404 if round not found, 409 if round is not in 'running' state,
    400 if Semantic Kernel is not initialized.
    """
    round_obj = db.session.get(Round, round_id)
    if not round_obj:
        raise NotFoundError(f'Round {round_id} not found')

    if round_obj.status != 'running':
        raise ConflictError(
            f'Round {round_id} has status "{round_obj.status}". '
            'Only rounds with status "running" can be executed.'
        )

    kernel = current_app.config.get('SK_KERNEL')
    if not kernel:
        raise ValidationError(
            'Semantic Kernel is not initialized. '
            'Check that OPENAI_API_KEY is set in .env and dependencies are installed.'
        )

    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_run_orchestration,
        args=(app, round_id, round_obj.total_emails),
        daemon=True,
    )
    thread.start()

    return jsonify({
        'success': True,
        'message': f'Orchestration started for round {round_id} ({round_obj.total_emails} emails)',
        'data': round_obj.to_dict(),
    }), 202
