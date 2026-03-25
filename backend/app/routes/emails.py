"""
Email management API endpoints.

GET  /api/rounds/<id>/emails    - List emails in a round (filter by verdict)
GET  /api/emails/<id>           - Get single email with all agent outputs
POST /api/emails/<id>/override  - Submit manual verdict correction
"""

from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from app.models import db, Round, Email, Override, API as APICall
from app.errors import ValidationError, NotFoundError, ConflictError
from app.utils import paginate

emails_bp = Blueprint('emails', __name__)


@emails_bp.route('/rounds/<int:round_id>/emails', methods=['GET'])
def list_emails_by_round(round_id):
    """
    List emails belonging to a round with optional verdict filter.

    Query params:
        verdict   (str): 'phishing' or 'legitimate'
        page      (int): page number
        per_page  (int): items per page
    """
    round_obj = db.session.get(Round, round_id)
    if not round_obj:
        raise NotFoundError(f'Round {round_id} not found')

    query = Email.query.filter_by(round_id=round_id)

    verdict = request.args.get('verdict')
    if verdict:
        allowed = {'phishing', 'legitimate'}
        if verdict not in allowed:
            raise ValidationError(f'verdict must be one of {allowed}')
        query = query.filter_by(detector_verdict=verdict)

    is_overridden = request.args.get('overridden')
    if is_overridden is not None:
        if is_overridden.lower() in ('true', '1', 'yes'):
            query = query.filter(Email.manual_override.is_(True))
        else:
            query = query.filter(
                (Email.manual_override.is_(False)) | (Email.manual_override.is_(None))
            )

    query = query.order_by(desc(Email.created_at))

    result = paginate(query)
    return jsonify({'success': True, **result}), 200


@emails_bp.route('/emails/<int:email_id>', methods=['GET'])
def get_email(email_id):
    """
    Get a single email with all agent outputs (generator, detector, override, API calls).

    Returns 200 with full email data.
    Raises 404 if email not found.
    """
    email = db.session.get(Email, email_id)
    if not email:
        raise NotFoundError(f'Email {email_id} not found')

    data = email.to_dict()

    override = Override.query.filter_by(email_id=email_id).first()
    data['override'] = override.to_dict() if override else None

    api_calls = APICall.query.filter_by(email_id=email_id).all()
    data['api_calls'] = [call.to_dict() for call in api_calls]

    data['final_verdict'] = email.get_final_verdict()
    data['is_false_positive'] = email.is_false_positive()
    data['is_false_negative'] = email.is_false_negative()

    return jsonify({'success': True, 'data': data}), 200


@emails_bp.route('/emails/<int:email_id>/override', methods=['POST'])
def create_override(email_id):
    """
    Submit a manual verdict correction for an email.

    Body (JSON):
        verdict       (str, required): 'correct', 'incorrect', 'phishing', or 'legitimate'
        overridden_by (str, optional): analyst name
        reason        (str, optional): reason for override

    After saving the override, updates the Email record and
    recalculates the parent round's accuracy.
    """
    email = db.session.get(Email, email_id)
    if not email:
        raise NotFoundError(f'Email {email_id} not found')

    existing = Override.query.filter_by(email_id=email_id).first()
    if existing:
        raise ConflictError(
            f'Email {email_id} already has an override. '
            'Delete the existing override first if you want to change it.'
        )

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError('Request body must be valid JSON')

    verdict = data.get('verdict')
    if not verdict:
        raise ValidationError('verdict is required')

    allowed_verdicts = {'correct', 'incorrect', 'phishing', 'legitimate'}
    if verdict not in allowed_verdicts:
        raise ValidationError(f'verdict must be one of {allowed_verdicts}')

    override = Override(
        email_id=email_id,
        verdict=verdict,
        overridden_by=data.get('overridden_by'),
        reason=data.get('reason'),
    )
    db.session.add(override)

    email.manual_override = True
    email.override_verdict = verdict
    email.override_reason = data.get('reason')
    email.overridden_by = data.get('overridden_by')
    email.overridden_at = datetime.utcnow()

    db.session.commit()

    round_obj = db.session.get(Round, email.round_id)
    if round_obj:
        round_obj.detector_accuracy = round_obj.calculate_accuracy()
        db.session.commit()

    return jsonify({
        'success': True,
        'data': override.to_dict(),
        'round_accuracy_updated': round_obj.detector_accuracy if round_obj else None,
    }), 201
