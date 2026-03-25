"""API route blueprints."""

from flask import Blueprint, jsonify, current_app
from sqlalchemy import text

from app.models import db

main_bp = Blueprint('main', __name__)


@main_bp.route('/health', methods=['GET'])
def health_check():
    """
    Enhanced health check — verifies database, Semantic Kernel, and Redis connectivity.

    Returns 200 if core services are reachable, 503 if any critical service is down.
    """
    checks = {}
    overall_healthy = True

    # Database
    try:
        db.session.execute(text('SELECT 1'))
        checks['database'] = {'status': 'healthy'}
    except Exception as e:
        checks['database'] = {'status': 'unhealthy', 'error': str(e)}
        overall_healthy = False

    # Semantic Kernel
    kernel = current_app.config.get('SK_KERNEL')
    if kernel is not None:
        checks['semantic_kernel'] = {'status': 'healthy', 'initialized': True}
    else:
        checks['semantic_kernel'] = {
            'status': 'degraded',
            'initialized': False,
            'message': 'SK not initialized — AI features unavailable',
        }

    # Redis
    try:
        redis_client = current_app.config.get('REDIS_CLIENT')
        if redis_client is not None:
            redis_client.ping()
            checks['redis'] = {'status': 'healthy'}
        else:
            checks['redis'] = {
                'status': 'degraded',
                'message': 'Redis client not configured',
            }
    except Exception as e:
        checks['redis'] = {'status': 'unhealthy', 'error': str(e)}

    status_code = 200 if overall_healthy else 503
    return jsonify({
        'status': 'healthy' if overall_healthy else 'unhealthy',
        'message': 'Phishing Detection API is running',
        'checks': checks,
    }), status_code
