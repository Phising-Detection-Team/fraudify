"""
Browser extension instance API.

POST   /api/extension/register              - Register / reuse extension instance (jwt required)
POST   /api/extension/heartbeat             - Update last_seen via instance_token (no jwt)
GET    /api/extension/instances             - List current user's instances (jwt required)
GET    /api/extension/instances/all         - List all instances across users (admin only)
DELETE /api/extension/instances/<id>        - Delete a specific instance (jwt required, owner only)
"""

from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import limiter, socketio
from app.models import db, User
from app.models.extension_instance import ExtensionInstance
from app.errors import ValidationError, NotFoundError
from app.utils import require_role

extension_bp = Blueprint('extension', __name__)

_STALE_DAYS = 30  # instances inactive for this long are auto-purged


# ---------------------------------------------------------------------------
# POST /api/extension/register
# ---------------------------------------------------------------------------

@extension_bp.route('/extension/register', methods=['POST'])
@jwt_required()
def register_instance():
    """
    Register or reuse an extension instance for the authenticated user.

    Idempotent: if an instance already exists for the same (user, browser, os_name)
    combination it is returned (with last_seen updated) rather than creating a
    duplicate.  Returns 201 for new instances, 200 for existing ones.

    Optional JSON body:
        browser (str): browser name/version, e.g. "Chrome 124"
        os_name (str): OS name/version, e.g. "Windows 11"
    """
    identity = get_jwt_identity()
    user_id = int(identity)
    data = request.get_json(silent=True) or {}
    browser = data.get('browser')
    os_name = data.get('os_name')

    existing = (
        ExtensionInstance.query
        .filter_by(user_id=user_id, browser=browser, os_name=os_name)
        .first()
    )

    if existing:
        existing.last_seen = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({'success': True, 'data': existing.to_dict()}), 200

    instance = ExtensionInstance(
        user_id=user_id,
        browser=browser,
        os_name=os_name,
        last_seen=datetime.now(timezone.utc),
    )
    db.session.add(instance)
    db.session.commit()

    return jsonify({'success': True, 'data': instance.to_dict()}), 201


# ---------------------------------------------------------------------------
# POST /api/extension/heartbeat
# ---------------------------------------------------------------------------

@extension_bp.route('/extension/heartbeat', methods=['POST'])
@jwt_required()
@limiter.limit('5 per minute')
def heartbeat():
    """
    Update last_seen for an extension instance using its token.

    JSON body (required):
        instance_token (str): the token returned at registration

    Returns 200 on success, 404 if token not found.
    """
    identity = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    token = data.get('instance_token', '').strip()
    if not token:
        raise ValidationError('instance_token is required')

    instance = ExtensionInstance.query.filter_by(
        instance_token=token,
        user_id=int(identity)
    ).first()

    if not instance:
        raise NotFoundError('Extension instance not found')

    instance.last_seen = datetime.now(timezone.utc)
    db.session.commit()

    socketio.emit('extension_heartbeat', {
        'instance_id': instance.id,
        'browser': instance.browser,
        'last_seen': instance.last_seen.isoformat(),
    }, room=str(identity))

    return jsonify({'success': True, 'is_active': instance.is_active}), 200


# ---------------------------------------------------------------------------
# GET /api/extension/instances
# ---------------------------------------------------------------------------

@extension_bp.route('/extension/instances', methods=['GET'])
@jwt_required()
def list_my_instances():
    """
    Return all extension instances for the authenticated user, newest first.

    Automatically deletes instances that have not been seen for more than
    _STALE_DAYS days (or that were created more than _STALE_DAYS days ago
    and never sent a heartbeat).
    """
    identity = get_jwt_identity()
    user_id = int(identity)
    cutoff = datetime.now(timezone.utc) - timedelta(days=_STALE_DAYS)

    stale = (
        ExtensionInstance.query
        .filter(
            ExtensionInstance.user_id == user_id,
            db.or_(
                ExtensionInstance.last_seen < cutoff,
                db.and_(
                    ExtensionInstance.last_seen.is_(None),
                    ExtensionInstance.created_at < cutoff,
                ),
            ),
        )
        .all()
    )
    for s in stale:
        db.session.delete(s)
    if stale:
        db.session.commit()

    instances = (
        ExtensionInstance.query
        .filter_by(user_id=user_id)
        .order_by(ExtensionInstance.created_at.desc())
        .all()
    )
    return jsonify({
        'success': True,
        'data': [i.to_dict() for i in instances],
    }), 200


# ---------------------------------------------------------------------------
# DELETE /api/extension/instances/<id>
# ---------------------------------------------------------------------------

@extension_bp.route('/extension/instances/<int:instance_id>', methods=['DELETE'])
@jwt_required()
def delete_instance(instance_id):
    """
    Delete a specific extension instance owned by the authenticated user.

    Returns 404 if the instance does not exist or belongs to another user.
    """
    identity = get_jwt_identity()
    instance = ExtensionInstance.query.filter_by(
        id=instance_id,
        user_id=int(identity),
    ).first()

    if not instance:
        raise NotFoundError('Extension instance not found')

    db.session.delete(instance)
    db.session.commit()
    return jsonify({'success': True}), 200


# ---------------------------------------------------------------------------
# GET /api/extension/instances/all
# ---------------------------------------------------------------------------

@extension_bp.route('/extension/instances/all', methods=['GET'])
@jwt_required()
def list_all_instances():
    """
    Return all extension instances across all users (admin only), newest first.

    Each item includes nested user info (username, email).
    """
    forbidden = require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    instances = (
        ExtensionInstance.query
        .order_by(ExtensionInstance.last_seen.desc().nullslast())
        .all()
    )

    result = []
    for inst in instances:
        d = inst.to_dict()
        if inst.user:
            d['user'] = {
                'id': inst.user.id,
                'username': inst.user.username,
                'email': inst.user.email,
            }
        result.append(d)

    active_count = sum(1 for inst in instances if inst.is_active)

    return jsonify({
        'success': True,
        'total': len(instances),
        'active': active_count,
        'data': result,
    }), 200
