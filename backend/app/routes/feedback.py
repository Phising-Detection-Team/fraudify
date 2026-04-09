from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError

from app.models import db, Feedback, User
from app.schemas.feedback import FeedbackCreateSchema, FeedbackUpdateStatusSchema
from app.utils import require_role
from app import limiter

feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route('/feedback', methods=['POST'])
@jwt_required()
@limiter.limit("5 per hour")
def submit_feedback():
    """
    Submit new feedback.
    Rate limit: 5 per hour per user.
    """
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "User not found"}), 404

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    schema = FeedbackCreateSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    feedback = Feedback(
        user_id=user.id,
        subject=validated_data.get('subject'),
        description=validated_data['description'],
        status='pending'
    )
    
    db.session.add(feedback)
    db.session.commit()

    return jsonify({
        "message": "Feedback submitted successfully.",
        "feedback": feedback.to_dict()
    }), 201


@feedback_bp.route('/feedback', methods=['GET'])
@jwt_required()
def list_feedback():
    """
    Return a paginated list of all feedback.
    Requires admin or super_admin role.
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status_filter = request.args.get('status')

    query = Feedback.query

    if status_filter:
        statuses = status_filter.split(',')
        if len(statuses) > 1:
            query = query.filter(Feedback.status.in_(statuses))
        else:
            query = query.filter(Feedback.status == status_filter)

    pagination = query.order_by(Feedback.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [f.to_dict() for f in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
        "per_page": per_page
    }), 200


@feedback_bp.route('/feedback/<int:feedback_id>/status', methods=['PATCH'])
@jwt_required()
def update_feedback_status(feedback_id):
    """
    Update the status of a specific feedback entry.
    Requires admin or super_admin role.
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    feedback = Feedback.query.get(feedback_id)
    if not feedback:
        return jsonify({"error": "Feedback not found"}), 404

    data = request.get_json() or {}
    schema = FeedbackUpdateStatusSchema()
    try:
        validated_data = schema.load(data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    feedback.status = validated_data['status']
    db.session.commit()

    return jsonify({
        "message": "Feedback status updated.",
        "feedback": feedback.to_dict()
    }), 200
