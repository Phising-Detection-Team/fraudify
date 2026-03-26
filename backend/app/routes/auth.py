"""Auth routes: /api/auth/*"""

from datetime import datetime, timezone, timedelta

import redis as redis_lib
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from marshmallow import ValidationError

from app.models import db, User, Role, InviteCode
from app.schemas.auth import SignupSchema, LoginSchema, InviteCodeSchema

auth_bp = Blueprint('auth', __name__)

_signup_schema = SignupSchema()
_login_schema = LoginSchema()
_invite_schema = InviteCodeSchema()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _blacklist_token(jti: str, expires_delta: timedelta) -> None:
    """Store jti in Redis with TTL equal to the token's remaining lifetime."""
    try:
        redis_url = current_app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        r = redis_lib.from_url(redis_url)
        r.setex(f'jwt_blacklist:{jti}', int(expires_delta.total_seconds()), '1')
    except Exception:
        pass  # Non-fatal; token will expire naturally


def _require_role(*role_names):
    """Return 403 if the current JWT user does not have one of the given roles."""
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user or not any(user.has_role(r) for r in role_names):
        return jsonify({'success': False, 'error': 'Forbidden', 'message': 'Insufficient role'}), 403
    return None


# ---------------------------------------------------------------------------
# POST /api/auth/signup
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/signup', methods=['POST'])
def signup():
    """Self-registration. Assigns 'user' role automatically."""
    try:
        data = _signup_schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'success': False, 'error': 'Validation failed', 'details': e.messages}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'error': 'Email already registered'}), 409
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'success': False, 'error': 'Username already taken'}), 409

    user_role = Role.query.filter_by(name='user').first()
    if not user_role:
        return jsonify({'success': False, 'error': 'Server misconfiguration: roles not seeded'}), 500

    user = User(email=data['email'], username=data['username'])
    user.set_password(data['password'])
    user.roles.append(user_role)
    db.session.add(user)
    db.session.commit()

    return jsonify({'success': True, 'user': user.to_dict()}), 201


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """Return JWT access + refresh token pair on valid credentials."""
    try:
        data = _login_schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'success': False, 'error': 'Validation failed', 'details': e.messages}), 400

    user = User.query.filter_by(email=data['email']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    if not user.is_active:
        return jsonify({'success': False, 'error': 'Account is deactivated'}), 403

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'success': True,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    }), 200


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """Blacklist the current access token's jti in Redis."""
    payload = get_jwt()
    jti = payload['jti']
    exp = payload.get('exp')

    if exp:
        remaining = datetime.fromtimestamp(exp, tz=timezone.utc) - datetime.now(tz=timezone.utc)
        _blacklist_token(jti, remaining)

    return jsonify({'success': True, 'message': 'Logged out'}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/refresh-token
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/refresh-token', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Issue a new access token from a valid refresh token."""
    identity = get_jwt_identity()
    new_access_token = create_access_token(identity=str(identity))
    return jsonify({'success': True, 'access_token': new_access_token}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/admin/invite  (admin/super_admin only)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/admin/invite', methods=['POST'])
@jwt_required()
def create_invite():
    """Generate an invite code that grants a specified role."""
    forbidden = _require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    try:
        data = _invite_schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'success': False, 'error': 'Validation failed', 'details': e.messages}), 400

    role = Role.query.filter_by(name=data['role_name']).first()
    if not role:
        return jsonify({'success': False, 'error': f"Role '{data['role_name']}' not found"}), 404

    creator_id = int(get_jwt_identity())
    invite = InviteCode.generate(
        created_by=creator_id,
        role_id=role.id,
        expires_in_days=data['expires_in_days'],
    )
    db.session.add(invite)
    db.session.commit()

    return jsonify({'success': True, 'invite': invite.to_dict()}), 201


# ---------------------------------------------------------------------------
# POST /api/auth/admin/signup  (invite-code registration)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/admin/signup', methods=['POST'])
def admin_signup():
    """Register a new user using an invite code. Assigns the role from the invite."""
    body = request.get_json(silent=True) or {}
    code_str = body.get('invite_code', '').strip()

    try:
        data = _signup_schema.load(body)
    except ValidationError as e:
        return jsonify({'success': False, 'error': 'Validation failed', 'details': e.messages}), 400

    if not code_str:
        return jsonify({'success': False, 'error': 'invite_code is required'}), 400

    invite = InviteCode.query.filter_by(code=code_str).first()
    if not invite:
        return jsonify({'success': False, 'error': 'Invalid invite code'}), 400
    if not invite.is_valid():
        return jsonify({'success': False, 'error': 'Invite code is expired or already used'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'error': 'Email already registered'}), 409
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'success': False, 'error': 'Username already taken'}), 409

    user = User(email=data['email'], username=data['username'])
    user.set_password(data['password'])
    user.roles.append(invite.role)
    db.session.add(user)

    # Mark invite as used
    invite.used_by = user.id if user.id else None  # will be set after flush
    db.session.flush()
    invite.used_by = user.id
    invite.used_at = datetime.utcnow()

    db.session.commit()

    return jsonify({'success': True, 'user': user.to_dict()}), 201
