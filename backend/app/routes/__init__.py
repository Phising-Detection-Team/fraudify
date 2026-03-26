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
        import redis as redis_lib
        redis_url = current_app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        r = redis_lib.from_url(redis_url)
        r.ping()
        checks['redis'] = {'status': 'healthy'}
    except Exception as e:
        checks['redis'] = {'status': 'degraded', 'message': str(e)}

    # JWT
    jwt_secret = current_app.config.get('JWT_SECRET_KEY')
    checks['jwt'] = {'status': 'healthy' if jwt_secret else 'degraded', 'configured': bool(jwt_secret)}

    status_code = 200 if overall_healthy else 503
    return jsonify({
        'status': 'healthy' if overall_healthy else 'unhealthy',
        'message': 'Phishing Detection API is running',
        'checks': checks,
    }), status_code
