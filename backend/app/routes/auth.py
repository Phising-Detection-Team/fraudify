"""Auth and permissions endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from app import db
from app.models.email_permission import EmailPermission
from app.models.user import User
from app.models.password_reset import PasswordReset
from app.models.log import Log
from app.utils.oauth_handler import GoogleOAuthHandler, OutlookOAuthHandler
from app.utils.encryption import encrypt_token
import bcrypt
import os
import re
import resend
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/url', methods=['GET'])
@jwt_required()
def get_auth_url():
    """Get the OAuth authorization URL for a specific provider."""
    provider = request.args.get('provider')

    if provider == 'gmail':
        handler = GoogleOAuthHandler()
    elif provider == 'outlook':
        handler = OutlookOAuthHandler()
    else:
        return jsonify({'error': "Invalid provider. Must be 'gmail' or 'outlook'"}), 400

    url = handler.get_authorization_url()
    if url:
        return jsonify({'url': url})
    return jsonify({'error': 'Failed to generate authorization URL'}), 500

@auth_bp.route('/grant-email-access', methods=['POST'])
@jwt_required()
def grant_email_access():
    """Handle OAuth redirect, exchange code for tokens, and save to DB."""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    provider = data.get('provider')
    code = data.get('code')
    scope = data.get('scope')  # 'read' or 'read_and_train'
    user_id = get_jwt_identity()

    if not all([provider, code, scope, user_id]):
        return jsonify({'error': 'Missing required fields (provider, code, scope, user_id)'}), 400

    if provider not in ['gmail', 'outlook']:
        return jsonify({'error': "Invalid provider. Must be 'gmail' or 'outlook'"}), 400

    if scope not in ['read', 'read_and_train']:
        return jsonify({'error': "Invalid scope. Must be 'read' or 'read_and_train'"}), 400

    # Exchange code for tokens
    if provider == 'gmail':
        handler = GoogleOAuthHandler()
    else:
        handler = OutlookOAuthHandler()

    tokens = handler.exchange_code(code)

    if not tokens:
        return jsonify({'error': 'Failed to exchange authorization code for tokens'}), 400

    # Encrypt the highly sensitive OAuth tokens before storing them in the DB
    encrypted_access_token = encrypt_token(tokens['access_token'])
    encrypted_refresh_token = encrypt_token(tokens.get('refresh_token')) if tokens.get('refresh_token') else None

    # Check if a permission record already exists for this user and provider
    existing_permission = EmailPermission.query.filter_by(
        user_id=user_id,
        provider=provider
    ).first()

    if existing_permission:
        existing_permission.access_token = encrypted_access_token
        if encrypted_refresh_token:
            existing_permission.refresh_token = encrypted_refresh_token
        existing_permission.scope = scope
        existing_permission.revoked_at = None
    else:
        new_permission = EmailPermission(
            user_id=user_id,
            provider=provider,
            access_token=encrypted_access_token,
            refresh_token=encrypted_refresh_token,
            scope=scope
        )
        db.session.add(new_permission)

    try:
        db.session.commit()
        return jsonify({'message': 'Email access granted successfully', 'scope': scope}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Handle new user signup with hashed credentials."""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    # Standard email validation
    email = email.lower().strip()
    email_pattern = r'^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    if not re.match(email_pattern, email):
        return jsonify({'error': 'Invalid email format'}), 400

    # Check if user already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        user_data = existing_user.to_dict()
        user_data['roles'] = ['admin'] if existing_user.is_admin else ['user']
        return jsonify({'error': 'User with this email already exists', 'user': user_data}), 409

    try:
        # Securely hash the password using bcrypt.
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

        new_user = User(
            email=email,
            password_hash=hashed_password,
            is_active=True,
            is_admin=False  # Regular users start as non-admin
        )

        db.session.add(new_user)
        db.session.commit()

        # Log successful signup without storing PII in logs
        Log.create_log('info', 'New user signed up', context={'user_id': str(new_user.id), 'is_admin': False})

        user_data = new_user.to_dict()
        # Return actual user roles based on is_admin flag
        user_data['roles'] = ['admin'] if new_user.is_admin else ['user']

        return jsonify({
            'message': 'User created successfully',
            'user': user_data
        }), 201

    except Exception as e:
        db.session.rollback()
        Log.create_log('error', f'Error during signup: {str(e)}')
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Handle user login with bcrypt hash verification."""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    email = email.lower().strip()

    user = User.query.filter_by(email=email).first()

    if not user:
        # Avoid user enumeration by giving a generic error
        Log.create_log('warning', 'Failed login attempt (user not found)')
        return jsonify({'error': 'Invalid email or password'}), 401

    try:
        # Verify password hash
        if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            Log.create_log('warning', 'Failed login attempt (bad password)', context={'user_id': str(user.id)})
            return jsonify({'error': 'Invalid email or password'}), 401

        if not user.is_active:
            Log.create_log('warning', 'Failed login attempt (inactive user)', context={'user_id': str(user.id)})
            return jsonify({'error': 'Account is inactive'}), 403

        # Return actual roles based on is_admin flag
        roles = ['admin'] if user.is_admin else ['user']

        # Log successful login
        Log.create_log('info', 'User logged in successfully', context={'user_id': str(user.id), 'roles': roles})

        user_data = user.to_dict()
        user_data['roles'] = roles

        additional_claims = {'role': 'admin' if user.is_admin else 'user'}
        access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
        refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims)

        return jsonify({
            'message': 'Login successful',
            'user': user_data,
            'access_token': access_token,
            'refresh_token': refresh_token,
        }), 200

    except Exception as e:
        if user:
            Log.create_log('error', f'Error during login: {str(e)}', context={'user_id': str(user.id)})
        else:
            Log.create_log('error', f'Error during login: {str(e)}')
        return jsonify({'error': f'An unexpected error occurred'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Issue a new access token using a valid refresh token."""
    identity = get_jwt_identity()
    claims = get_jwt()
    additional_claims = {'role': claims.get('role', 'user')}
    access_token = create_access_token(identity=identity, additional_claims=additional_claims)
    return jsonify({'access_token': access_token}), 200


@auth_bp.route('/send-verification-email', methods=['POST'])
def send_verification_email():
    """Send verification email with code and link."""
    from app.services.email_verification_service import EmailVerificationService

    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    user_id = data.get('user_id')
    user_email = data.get('email')
    user_name = data.get('name')

    if not user_id or not user_email:
        return jsonify({'error': 'user_id and email are required'}), 400

    try:
        service = EmailVerificationService()
        result = service.send_verification_email(user_id, user_email, user_name)

        if result.get('success'):
            # Remove code from response in production (only for testing)
            Log.create_log('info', 'Verification email sent', context={'user_id': user_id})
            response = {
                'success': True,
                'message': result.get('message')
            }
            # Optionally include code for development/testing
            if request.args.get('debug') == 'true':
                response['code'] = result.get('code')
            return jsonify(response), 200
        else:
            Log.create_log('warning', f'Failed to send verification email: {result.get("error")}', context={'user_id': user_id})
            return jsonify({'success': False, 'error': result.get('error')}), 400

    except Exception as e:
        Log.create_log('error', f'Error sending verification email: {str(e)}', context={'user_id': user_id})
        return jsonify({'error': f'Failed to send verification email: {str(e)}'}), 500


@auth_bp.route('/verify-email-code', methods=['POST'])
def verify_email_code():
    """Verify email using code or token."""
    from app.services.email_verification_service import EmailVerificationService

    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    user_id = data.get('user_id')
    code = data.get('code')
    token = data.get('token')

    if not user_id or (not code and not token):
        return jsonify({'error': 'user_id and (code or token) are required'}), 400

    try:
        service = EmailVerificationService()

        if code:
            # Verify by code
            result = service.verify_email_by_code(user_id, code)
        else:
            # Verify by token
            result = service.verify_email_by_token(token)

        if result.get('success'):
            Log.create_log('info', 'Email verified successfully', context={'user_id': user_id})
            return jsonify(result), 200
        else:
            Log.create_log('warning', f'Email verification failed: {result.get("error")}', context={'user_id': user_id})
            return jsonify(result), 400

    except Exception as e:
        Log.create_log('error', f'Error verifying email: {str(e)}', context={'user_id': user_id})
        return jsonify({'error': f'Failed to verify email: {str(e)}'}), 500


@auth_bp.route('/verify-email', methods=['GET'])
def verify_email_link():
    """Handle email verification link click - redirect with token."""
    from app.services.email_verification_service import EmailVerificationService

    token = request.args.get('token')
    if not token:
        return jsonify({'error': 'Verification token is required'}), 400

    try:
        service = EmailVerificationService()
        result = service.verify_email_by_token(token)

        if result.get('success'):
            Log.create_log('info', 'Email verified via link', context={'user_id': result.get('user_id')})
            # Redirect to frontend with success message and user_id
            frontend_url = request.args.get('redirect', 'http://localhost:3000/signup?step=provider&verified=true')
            return jsonify({
                'success': True,
                'message': 'Email verified successfully',
                'user_id': result.get('user_id'),
                'redirect': frontend_url
            }), 200
        else:
            Log.create_log('warning', f'Email verification link failed: {result.get("error")}')
            return jsonify({
                'success': False,
                'error': result.get('error')
            }), 400

    except Exception as e:
        Log.create_log('error', f'Error verifying email via link: {str(e)}')
        return jsonify({'error': f'Failed to verify email: {str(e)}'}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Send a password reset link to the user's email."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    email = data.get('email', '').lower().strip()
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Always return 200 to avoid leaking whether an account exists
    generic_response = jsonify({'message': 'If an account exists for that email, a reset link has been sent.'}), 200

    user = User.query.filter_by(email=email).first()
    if not user:
        return generic_response

    try:
        # Invalidate any existing reset tokens for this user
        PasswordReset.query.filter_by(user_id=user.id).delete()

        token = PasswordReset.generate_token()
        reset = PasswordReset(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        db.session.add(reset)
        db.session.commit()

        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/reset-password?token={token}"

        resend.api_key = os.environ.get('RESEND_API_KEY')
        resend.Emails.send({
            "from": os.environ.get('RESEND_FROM_EMAIL', 'noreply@yourapp.com'),
            "to": email,
            "subject": "Reset Your Password - Sentra",
            "html": f"""
            <!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#00d9ff;">Reset Your Password</h2>
            <p>Hi {user.email},</p>
            <p>We received a request to reset your Sentra account password. Click the button below to set a new password:</p>
            <div style="text-align:center;margin:30px 0;">
                <a href="{reset_link}" style="background:#00d9ff;color:black;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    Reset Password
                </a>
            </div>
            <p style="color:#666;font-size:13px;">This link expires in <strong>1 hour</strong>. If you didn't request this, please ignore this email — your password won't change.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#999;font-size:12px;">© 2026 Sentra. All rights reserved.</p>
            </body></html>
            """
        })

        Log.create_log('info', 'Password reset email sent', context={'user_id': str(user.id)})
        return generic_response

    except Exception as e:
        db.session.rollback()
        Log.create_log('error', f'Error sending password reset email: {str(e)}', context={'user_id': str(user.id)})
        return generic_response


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset the user's password using a valid reset token."""
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    token = data.get('token', '').strip()
    password = data.get('password', '')

    if not token or not password:
        return jsonify({'error': 'Token and new password are required'}), 400

    # Validate password strength (matches signup requirements)
    if len(password) <= 10:
        return jsonify({'error': 'Password must be more than 10 characters'}), 400
    if not re.search(r'\d', password):
        return jsonify({'error': 'Password must contain at least one number'}), 400
    if not re.search(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|`~]', password):
        return jsonify({'error': 'Password must contain at least one symbol'}), 400

    reset = PasswordReset.query.filter_by(token=token).first()
    if not reset:
        return jsonify({'error': 'Invalid or expired reset link'}), 400
    if reset.is_used():
        return jsonify({'error': 'This reset link has already been used'}), 400
    if reset.is_expired():
        return jsonify({'error': 'This reset link has expired. Please request a new one'}), 400

    try:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

        reset.user.password_hash = hashed
        reset.used_at = datetime.utcnow()
        db.session.commit()

        Log.create_log('info', 'Password reset successfully', context={'user_id': str(reset.user_id)})
        return jsonify({'message': 'Password reset successfully'}), 200

    except Exception as e:
        db.session.rollback()
        Log.create_log('error', f'Error resetting password: {str(e)}', context={'user_id': str(reset.user_id)})
        return jsonify({'error': 'Failed to reset password'}), 500
