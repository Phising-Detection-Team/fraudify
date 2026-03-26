"""Flask application factory and initialization."""

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO

from .config import get_config
from .models import db
from .errors import register_error_handlers

migrate = Migrate()
socketio = SocketIO()

# Graceful fallbacks for services that may not exist
try:
    from .services.kernel_service import KernelService
    kernel_service = KernelService()
except ImportError:
    kernel_service = None

try:
    from .services.cache_service import cache
except ImportError:
    cache = None


def create_app(config_name=None):
    """
    Application Factory Pattern.

    Creates and configures a Flask app instance.

    Args:
        config_name: Environment name ('development', 'testing', 'production')
                     Defaults to FLASK_ENV or 'development'

    Returns:
        Fully configured Flask app instance
    """

    app = Flask(__name__)

    config = get_config(config_name)
    app.config.from_object(config)

    db.init_app(app)
    migrate.init_app(app, db)

    CORS(app, resources={r'/api/*': {'origins': app.config.get('CORS_ORIGINS', '*')}})
    socketio.init_app(app, cors_allowed_origins=app.config.get('CORS_ORIGINS', '*'))

    register_error_handlers(app)

    if kernel_service:
        kernel_service.init_app(app)

    if cache:
        cache.init_app(app)

    with app.app_context():
        from .models.email import Email
        from .models.round import Round
        from .models.log import Log
        from .models.api import API
        from .models.override import Override

        db.create_all()

    _register_blueprints(app)

    return app


def _register_blueprints(app):
    """Register all API blueprints.

    Imports are inside the function to avoid circular imports.
    """
    from .routes import main_bp
    from .routes.auth import auth_bp
    from .routes.users import users_bp
    from .routes.rounds import rounds_bp
    from .routes.emails import emails_bp
    from .routes.logs import logs_bp
    from .routes.costs import costs_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(rounds_bp, url_prefix='/api')
    app.register_blueprint(emails_bp, url_prefix='/api')
    app.register_blueprint(logs_bp, url_prefix='/api')
    app.register_blueprint(costs_bp, url_prefix='/api')
