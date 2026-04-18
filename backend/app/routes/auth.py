"""Auth routes: /api/auth/*"""

import hashlib
import secrets
import re
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
from flask_mail import Message
from marshmallow import ValidationError

from app import mail, limiter
from app.models import db, User, Role, InviteCode, EmailVerification
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
        redis_url: str = current_app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        r = redis_lib.from_url(redis_url)
        r.setex(f'jwt_blacklist:{jti}', int(expires_delta.total_seconds()), '1')
    except Exception as exc:
        current_app.logger.warning('JWT blacklist write failed: %s', exc)


def _require_role(*role_names):
    """Return 403 if the current JWT user does not have one of the given roles."""
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user or not any(user.has_role(r) for r in role_names):
        return jsonify({'success': False, 'error': 'Forbidden', 'message': 'Insufficient role'}), 403
    return None


def _generate_username(email: str) -> str:  # noqa: D401
    """
    Auto-generate a username from the email local-part.
    Strips non-alphanumeric/underscore chars, truncates to 25 chars,
    appends a 4-digit random suffix. Retries up to 5 times on collision.
    """
    local = email.split('@')[0]
    base = re.sub(r'[^A-Za-z0-9_]', '', local)[:25] or 'user'
    for _ in range(5):
        candidate = f'{base}{secrets.randbelow(9000) + 1000}'
        if not User.query.filter_by(username=candidate).first():
            return candidate
    # Fallback: keep trying with wider range
    return f'{base}{secrets.randbelow(90000) + 10000}'


def _send_verification(user: User) -> bool:
    """Create an EmailVerification record and dispatch the Resend email.

    Returns True if the email was dispatched successfully, False otherwise.
    """
    from app.services.email_verification_service import send_verification_email

    ev = EmailVerification.generate(user.id)
    db.session.add(ev)
    db.session.flush()  # get ev.token/code before commit

    sent = send_verification_email(
        to_email=user.email,
        token=ev.token,
        code=ev.code,
        frontend_url=current_app.config.get('FRONTEND_URL', 'http://localhost:3000'),
        from_email=current_app.config.get('RESEND_FROM_EMAIL', 'noreply@example.com'),
        api_key=current_app.config.get('RESEND_API_KEY', ''),
    )
    if not sent:
        current_app.logger.warning('Verification email failed to send for user %s', user.id)
    return sent


# ---------------------------------------------------------------------------
# POST /api/auth/signup
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/signup', methods=['POST'])
@limiter.limit("5 per minute")
def signup():
    """Self-registration. Creates user with email_verified=False and sends verification email."""
    try:
        data = _signup_schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'success': False, 'error': 'Validation failed', 'details': e.messages}), 400

    existing = User.query.filter_by(email=data['email']).first()
    if existing:
        if not existing.email_verified:
            return jsonify({
                'success': False,
                'error': 'Email already registered',
                'message': 'An account with this email exists but is not yet verified. Please check your inbox.',
            }), 409
        return jsonify({'success': False, 'error': 'Email already registered'}), 409

    explicit_username = data.get('username')
    username = explicit_username or _generate_username(data['email'])
    if User.query.filter_by(username=username).first():
        if explicit_username:
            return jsonify({'success': False, 'error': 'Username already taken'}), 409
        username = _generate_username(data['email'])

    user_role = Role.query.filter_by(name='user').first()
    if not user_role:
        return jsonify({'success': False, 'error': 'Server misconfiguration: roles not seeded'}), 500

    user = User(email=data['email'], username=username)
    user.set_password(data['password'])
    user.roles.append(user_role)
    db.session.add(user)
    db.session.flush()

    _send_verification(user)
    db.session.commit()

    return jsonify({'success': True, 'user_id': user.id, 'email': user.email}), 201


# ---------------------------------------------------------------------------
# POST /api/auth/send-verification
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/send-verification', methods=['POST'])
def send_verification():
    """(Re)send a verification email to an unverified user."""
    body = request.get_json(silent=True) or {}
    email = (body.get('email') or '').strip()
    if not email:
        return jsonify({'success': False, 'error': 'email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Don't reveal whether the email exists
        return jsonify({'success': True}), 200

    if user.email_verified:
        return jsonify({'success': False, 'error': 'Email already verified'}), 400

    # Prevent email bombing: reject if an unexpired code already exists
    existing = (
        EmailVerification.query
        .filter_by(user_id=user.id, is_used=False)
        .filter(EmailVerification.expires_at > datetime.utcnow())
        .first()
    )
    if existing:
        return jsonify({'success': False, 'error': 'A verification code was recently sent. Please wait before requesting another.'}), 429

    _send_verification(user)
    db.session.commit()

    return jsonify({'success': True}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/verify-email
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/verify-email', methods=['POST'])
def verify_email():
    """
    Verify an email address.
    Accepts either:
      - {email, code}  — 6-digit code from email
      - {token}        — URL token from the link in the email
    On success, returns JWT access + refresh tokens.
    """
    body = request.get_json(silent=True) or {}
    token = (body.get('token') or '').strip()
    code = (body.get('code') or '').strip()
    email = (body.get('email') or '').strip()

    ev = None

    if token:
        ev = EmailVerification.query.filter_by(token=token).first()
    elif code and email:
        user = User.query.filter_by(email=email).first()
        if user:
            ev = (
                EmailVerification.query
                .filter_by(user_id=user.id, code=code)
                .order_by(EmailVerification.created_at.desc())
                .first()
            )

    if not ev or not ev.is_valid():
        return jsonify({'success': False, 'error': 'Invalid or expired code'}), 400

    user = db.session.get(User, ev.user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    ev.is_used = True
    ev.used_at = datetime.utcnow()
    user.email_verified = True
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'success': True,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    }), 200


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
@limiter.limit("5 per minute", key_func=lambda: request.get_json(silent=True).get('email', 'unknown') if request.get_json(silent=True) else 'unknown')
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

    if not user.email_verified:
        return jsonify({
            'success': False,
            'error': 'Email not verified',
            'message': 'Please verify your email address before logging in.',
        }), 403

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
# GET /api/auth/invites  (admin/super_admin only)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/invites', methods=['GET'])
@jwt_required()
def list_invites():
    """Return all active (non-expired, non-used) invite codes for the org."""
    forbidden = _require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    now = datetime.now(timezone.utc)
    invites = InviteCode.query.filter(
        InviteCode.used_by.is_(None),
        InviteCode.expires_at > now,
    ).all()

    data = [
        {
            'code': inv.code,
            'role': inv.role.name if inv.role else None,
            'expires_at': inv.expires_at.isoformat() if inv.expires_at else None,
            'uses_left': 1,
        }
        for inv in invites
    ]
    return jsonify({'success': True, 'data': data}), 200


# ---------------------------------------------------------------------------
# DELETE /api/auth/invites/<code>  (admin/super_admin only)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/invites/<string:code>', methods=['DELETE'])
@jwt_required()
def revoke_invite(code: str):
    """Revoke (permanently delete) an invite code."""
    forbidden = _require_role('admin', 'super_admin')
    if forbidden:
        return forbidden

    invite = InviteCode.query.filter_by(code=code).first()
    if not invite:
        return jsonify({'success': False, 'error': 'Invite code not found'}), 404

    db.session.delete(invite)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Invite code revoked'}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/admin/signup  (invite-code registration)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/admin/signup', methods=['POST'])
@limiter.limit("5 per minute")
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

    username = data.get('username') or _generate_username(data['email'])
    if User.query.filter_by(username=username).first():
        username = _generate_username(data['email'])

    user = User(email=data['email'], username=username)
    user.set_password(data['password'])
    user.roles.append(invite.role)
    # Admin-invited users are considered verified
    user.email_verified = True
    db.session.add(user)

    db.session.flush()
    invite.used_by = user.id
    invite.used_at = datetime.now(timezone.utc)

    db.session.commit()

    return jsonify({'success': True, 'user': user.to_dict()}), 201


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    """Return the authenticated user's profile."""
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    return jsonify({'success': True, 'user': user.to_dict()}), 200


# ---------------------------------------------------------------------------
# PUT /api/auth/me/password
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/me/password', methods=['PUT'])
@jwt_required()
def change_password():
    """
    Change the authenticated user's password.

    Body (JSON):
        current_password (str, required): current password for verification
        new_password     (str, required): new password (min 8 chars)
    """
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    body = request.get_json(silent=True) or {}
    current_password = body.get('current_password', '')
    new_password = body.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({
            'success': False,
            'error': 'current_password and new_password are required',
        }), 400

    if not user.check_password(current_password):
        return jsonify({'success': False, 'error': 'Current password is incorrect'}), 401

    if len(new_password) < 8:
        return jsonify({'success': False, 'error': 'New password must be at least 8 characters'}), 400

    user.set_password(new_password)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Password updated successfully'}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/forgot-password
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/forgot-password', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password():
    """
    Request a password reset email.

    Always returns 200 to avoid leaking whether an email is registered.
    """
    body = request.get_json(silent=True) or {}
    email = body.get('email', '').strip().lower()
    if not email:
        return jsonify({'success': False, 'error': 'email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expiry_hours = current_app.config.get('PASSWORD_RESET_EXPIRY_HOURS', 1)

        user.password_reset_token = token_hash
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)
        db.session.commit()

        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/reset-password?token={raw_token}"

        try:
            msg = Message(
                subject='Reset your Sentra password',
                recipients=[user.email],
                body=(
                    f"Hi {user.username},\n\n"
                    f"You requested a password reset. Click the link below to set a new password:\n\n"
                    f"{reset_link}\n\n"
                    f"This link expires in {expiry_hours} hour(s). If you didn't request this, "
                    f"you can safely ignore this email.\n\n"
                    f"— The Sentra Team"
                ),
                html=(
                    f"<p>Hi <strong>{user.username}</strong>,</p>"
                    f"<p>You requested a password reset. Click the button below to set a new password:</p>"
                    f"<p><a href='{reset_link}' style='background:#2563eb;color:#fff;padding:10px 20px;"
                    f"border-radius:6px;text-decoration:none;'>Reset Password</a></p>"
                    f"<p>This link expires in <strong>{expiry_hours} hour(s)</strong>. "
                    f"If you didn't request this, you can safely ignore this email.</p>"
                    f"<p>— The Sentra Team</p>"
                ),
            )
            mail.send(msg)
        except Exception as exc:
            current_app.logger.warning('Failed to send password reset email: %s', exc)

    return jsonify({'success': True, 'message': 'If that email is registered you will receive a reset link shortly'}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/reset-password
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Reset the user's password using a valid reset token.

    Body (JSON):
        token    (str, required): raw token from the reset email link
        password (str, required): new password (min 8 chars)
    """
    body = request.get_json(silent=True) or {}
    raw_token = body.get('token', '').strip()
    new_password = body.get('password', '').strip()

    if not raw_token or not new_password:
        return jsonify({'success': False, 'error': 'token and password are required'}), 400

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    user = User.query.filter_by(password_reset_token=token_hash).first()
    if not user or not user.password_reset_expires or user.password_reset_expires < now:
        return jsonify({'success': False, 'error': 'Invalid or expired reset token'}), 400

    try:
        user.set_password(new_password)
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    user.password_reset_token = None
    user.password_reset_expires = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Password has been reset. You can now sign in.'}), 200
