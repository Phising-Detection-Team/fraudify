"""User management endpoints."""

from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User
from app.models.log import Log
from app.models.email import Email

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('', methods=['GET'])
def get_all_users():
    """Get all users (admin only)."""
    requester_id = request.args.get('requester_id')
    
    if not requester_id:
        return jsonify({'error': 'requester_id query parameter is required'}), 400
    
    # Verify requester is admin
    requester = User.query.filter_by(id=requester_id).first()
    if not requester or not requester.is_admin:
        Log.create_log('warning', f'Unauthorized user list attempt', context={'requester_id': str(requester_id)})
        return jsonify({'error': 'Unauthorized - only admins can view all users'}), 403
    
    try:
        users = User.query.all()
        users_data = [user.to_dict() for user in users]
        
        return jsonify({
            'message': 'Users retrieved successfully',
            'count': len(users_data),
            'users': users_data
        }), 200
        
    except Exception as e:
        Log.create_log('error', f'Error retrieving users: {str(e)}')
        return jsonify({'error': f'Failed to retrieve users: {str(e)}'}), 500


@users_bp.route('/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get a specific user by ID."""
    try:
        user = User.query.filter_by(id=user_id).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'message': 'User retrieved successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        Log.create_log('error', f'Error retrieving user {user_id}: {str(e)}')
        return jsonify({'error': f'Failed to retrieve user: {str(e)}'}), 500


@users_bp.route('/<user_id>/admin', methods=['GET'])
def check_admin_status(user_id):
    """Check if a user is an admin."""
    try:
        user = User.query.filter_by(id=user_id).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user_id': str(user.id),
            'email': user.email,
            'is_admin': user.is_admin
        }), 200
        
    except Exception as e:
        Log.create_log('error', f'Error checking admin status for user {user_id}: {str(e)}')
        return jsonify({'error': f'Failed to check admin status: {str(e)}'}), 500


@users_bp.route('/stats', methods=['GET'])
def get_user_stats():
    """Get statistics for a user or admin."""
    # This would be replaced by a proper user identification mechanism
    user_id = request.headers.get('Authorization').split(' ')[1]  # Placeholder
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.is_admin:
        # Admin stats logic
        total_api_cost = db.session.query(db.func.sum(Log.context['cost'].as_float())).scalar() or 0
        active_agents = 0  # Placeholder for agent logic
        total_emails_scanned = db.session.query(db.func.count(Email.id)).scalar()
        phishing_detected = db.session.query(db.func.count(Email.id)).filter(Email.verdict == 'phishing').scalar()
        stats = {
            'totalApiCost': total_api_cost,
            'activeAgents': active_agents,
            'totalEmailsScanned': total_emails_scanned,
            'phishingDetected': phishing_detected,
        }
    else:
        # User stats logic
        total_emails_scanned = db.session.query(db.func.count(Email.id)).filter(Email.owner_id == user.id).scalar()
        phishing_detected = db.session.query(db.func.count(Email.id)).filter(Email.owner_id == user.id, Email.verdict == 'phishing').scalar()
        marked_safe = db.session.query(db.func.count(Email.id)).filter(Email.owner_id == user.id, Email.verdict == 'safe').scalar()
        stats = {
            'totalEmailsScanned': total_emails_scanned,
            'phishingDetected': phishing_detected,
            'markedSafe': marked_safe,
            'creditsRemaining': 1000,  # Placeholder
        }
        
    return jsonify(stats), 200
