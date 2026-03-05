"""Flask application factory and initialization."""

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO

from .config import get_config
from .models import db
from .errors import register_error_handlers
from .services.kernel_service import KernelService
from .services.cache_service import cache

migrate = Migrate()
kernel_service = KernelService()
socketio = SocketIO()


def create_app(config_env=None):
    """
    Application Factory Pattern.

    Creates and configures a Flask app instance.

    Args:
        config_env: Environment name ('development', 'testing', 'production')
                    Defaults to FLASK_ENV or 'development'

    Returns:
        Fully configured Flask app instance
    """

    app = Flask(__name__)

    config = get_config(config_env)
    app.config.from_object(config)

    db.init_app(app)
    migrate.init_app(app, db)

    CORS(app, resources={r'/api/*': {'origins': app.config.get('CORS_ORIGINS', '*')}})
    socketio.init_app(app, cors_allowed_origins=app.config.get('CORS_ORIGINS', '*'))

    register_error_handlers(app)

    kernel_service.init_app(app)

    cache.init_app(app)

    with app.app_context():
        from app.models.email import Email
        from app.models.round import Round
        from app.models.log import Log
        from app.models.api import API
        from app.models.override import Override

        db.create_all()

    register_blueprints(app)

    return app


def register_blueprints(app):
    """
    Register all blueprints (route modules) with the app.

    Imports are inside the function to avoid circular imports.
    """
    from app.routes import main_bp
    from app.routes.rounds import rounds_bp
    from app.routes.emails import emails_bp
    from app.routes.logs import logs_bp
    from app.routes.costs import costs_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(rounds_bp, url_prefix='/api')
    app.register_blueprint(emails_bp, url_prefix='/api')
    app.register_blueprint(logs_bp, url_prefix='/api')
    app.register_blueprint(costs_bp, url_prefix='/api')
