"""Flask application factory and initialization."""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO

from app.models import db
from app.config import config
from app.utils.errors import AppError, error_response

# Global extension instances
socketio = SocketIO()
migrate = Migrate()


def create_app(config_name=None):
    """Application factory function.

    Args:
        config_name: Config name ('development', 'testing', 'production').
                     If None, reads FLASK_ENV environment variable.

    Returns:
        Flask application instance with initialized extensions.
    """
    app = Flask(__name__)

    # Load configuration
    cfg_name = config_name or os.environ.get('FLASK_ENV', 'default')
    app.config.from_object(config[cfg_name])

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r'/api/*': {'origins': app.config['CORS_ORIGINS']}})
    socketio.init_app(app, cors_allowed_origins=app.config['CORS_ORIGINS'])

    # Register blueprints
    _register_blueprints(app)

    # Register error handlers
    _register_error_handlers(app)

    return app


def _register_blueprints(app):
    """Register all API blueprints."""
    from app.routes import health_bp, rounds_bp, emails_bp, logs_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(rounds_bp)
    app.register_blueprint(emails_bp)
    app.register_blueprint(logs_bp)


def _register_error_handlers(app):
    """Register global error handlers for consistent error responses."""

    @app.errorhandler(400)
    def handle_bad_request(e):
        return error_response('BAD_REQUEST', 'Invalid request', 400)

    @app.errorhandler(404)
    def handle_not_found(e):
        return error_response('NOT_FOUND', 'Resource not found', 404)

    @app.errorhandler(405)
    def handle_method_not_allowed(e):
        return error_response('METHOD_NOT_ALLOWED', 'Method not allowed', 405)

    @app.errorhandler(500)
    def handle_internal_error(e):
        return error_response('INTERNAL_SERVER_ERROR', 'Internal server error', 500)

    @app.errorhandler(AppError)
    def handle_app_error(e):
        """Handle custom application errors."""
        return jsonify(e.to_dict()), e.status_code

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        """Handle unexpected errors with 500 response."""
        if app.config.get('DEBUG'):
            raise e
        return error_response(
            'INTERNAL_SERVER_ERROR',
            'An unexpected error occurred',
            500,
        )
