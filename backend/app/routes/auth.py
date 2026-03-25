"""Auth and permissions endpoints."""

from flask import Blueprint, request, jsonify
from app import db
from app.models.email_permission import EmailPermission
from app.models.admin import Admin
from app.models.user import User
from app.models.log import Log
from app.utils.oauth_handler import GoogleOAuthHandler, OutlookOAuthHandler
from app.utils.encryption import encrypt_token
import bcrypt
import re
from datetime import datetime
# In a real scenario, this would use flask_jwt_extended or similar to get the user
# from flask_jwt_extended import jwt_required, get_jwt_identity

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/url', methods=['GET'])
# @jwt_required()
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
# @jwt_required()
def grant_email_access():
    """Handle OAuth redirect, exchange code for tokens, and save to DB."""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    provider = data.get('provider')
    code = data.get('code')
    scope = data.get('scope')  # 'read' or 'read_and_train'
    user_id = data.get('user_id')  # In production, get from JWT: get_jwt_identity()
    
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
        return jsonify({'error': 'User with this email already exists'}), 409
        
    try:
        # Securely hash the password using bcrypt. 
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        new_user = User(
            email=email,
            password_hash=hashed_password,
            is_active=True
        )
        
        db.session.add(new_user)
        db.session.flush() # Flush to get new_user.id
        
        # Every authenticated account has admin privileges.
        new_admin = Admin(user_id=new_user.id)
        db.session.add(new_admin)
        roles = ['user', 'admin']
            
        db.session.commit()
        
        # Log successful signup
        Log.create_log('info', f'New user signed up', context={'email': email, 'is_admin': True, 'user_id': str(new_user.id)})
        
        user_data = new_user.to_dict()
        user_data['roles'] = roles
        
        return jsonify({
            'message': 'User created successfully', 
            'user': user_data
        }), 201
        
    except Exception as e:
        db.session.rollback()
        Log.create_log('error', f'Error during signup: {str(e)}', context={'email': email})
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
        Log.create_log('warning', f'Failed login attempt (user not found)', context={'email': email})
        return jsonify({'error': 'Invalid email or password'}), 401
        
    try:
        # Verify password hash
        if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            Log.create_log('warning', f'Failed login attempt (bad password)', context={'email': email, 'user_id': str(user.id)})
            return jsonify({'error': 'Invalid email or password'}), 401
            
        if not user.is_active:
            Log.create_log('warning', f'Failed login attempt (inactive user)', context={'email': email, 'user_id': str(user.id)})
            return jsonify({'error': 'Account is inactive'}), 403
            
        roles = ['user', 'admin']
            
        # Log successful login
        Log.create_log('info', f'User logged in successfully', context={'email': email, 'user_id': str(user.id), 'roles': roles})
        
        user_data = user.to_dict()
        user_data['roles'] = roles
        
        # We would normally generate a JWT token here and return it
        # For now, we return user data that NextAuth can use
        # (TODO: integrate flask_jwt_extended)
        return jsonify({
            'message': 'Login successful',
            'user': user_data
        }), 200
        
    except Exception as e:
        Log.create_log('error', f'Error during login: {str(e)}', context={'email': email})
        return jsonify({'error': f'An unexpected error occurred'}), 500
