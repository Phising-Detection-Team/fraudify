"""Flask application factory and initialization."""

from celery import Celery
from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .config import get_config
from .models import db
from .errors import register_error_handlers

migrate = Migrate()
socketio = SocketIO()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address)
mail = Mail()

# Module-level Celery instance (configured inside create_app)
celery = Celery(__name__)

# Graceful fallbacks for services that may not exist
try:
    from .services.kernel_service import KernelService
    kernel_service = KernelService()
except ImportError:
    kernel_service = None



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
    jwt.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)

    # ── Celery ────────────────────────────────────────────────────────────────
    redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
    celery.conf.update(
        broker_url=redis_url,
        result_backend=app.config.get('CELERY_RESULT_BACKEND', redis_url),
        task_serializer='json',
        result_serializer='json',
        accept_content=['json'],
        task_track_started=True,
        task_always_eager=app.config.get('CELERY_TASK_ALWAYS_EAGER', False),
        task_eager_propagates=app.config.get('CELERY_TASK_EAGER_PROPAGATES', False),
        broker_transport_options=app.config.get('BROKER_TRANSPORT_OPTIONS', {}),
        broker_connection_retry=True,
        broker_connection_retry_on_startup=True,
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask

    CORS(app, resources={r'/api/*': {'origins': app.config.get('CORS_ORIGINS', '*')}})
    socketio.init_app(app, cors_allowed_origins=app.config.get('CORS_ORIGINS', '*'))

    register_error_handlers(app)

    if kernel_service:
        kernel_service.init_app(app)

    # Register JWT token blacklist checker (uses Redis in production, skipped in tests)
    _register_jwt_callbacks(app)

    # Import models so SQLAlchemy metadata is populated (needed for Alembic autogenerate)
    with app.app_context():
        from .models.email import Email  # noqa: F401
        from .models.round import Round  # noqa: F401
        from .models.log import Log  # noqa: F401
        from .models.api import API  # noqa: F401
        from .models.override import Override  # noqa: F401
        from .models.user import User  # noqa: F401
        from .models.role import Role, user_roles  # noqa: F401
        from .models.invite_code import InviteCode  # noqa: F401
        from .models.training_data_log import TrainingDataLog  # noqa: F401
        from .models.extension_instance import ExtensionInstance  # noqa: F401
        from .models.email_verification import EmailVerification  # noqa: F401
        from .models.user_scan import UserScan  # noqa: F401

    _register_blueprints(app)

    # Register CLI commands
    from .commands import seed_cmd
    app.cli.add_command(seed_cmd)

    return app


def _register_jwt_callbacks(app):
    """Set up JWT token-in-blocklist check via Redis."""

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        import redis as redis_lib
        jti = jwt_payload.get('jti')
        if not jti:
            return False
        try:
            redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
            r = redis_lib.from_url(redis_url)
            return r.exists(f'jwt_blacklist:{jti}') == 1
        except Exception:
            # If Redis is unavailable, don't block the request
            return False


def _register_blueprints(app):
    """Register all API blueprints."""
    from .routes import main_bp
    from .routes.rounds import rounds_bp
    from .routes.emails import emails_bp
    from .routes.logs import logs_bp
    from .routes.costs import costs_bp
    from .routes.auth import auth_bp
    from .routes.stats import stats_bp
    from .routes.extension import extension_bp
    from .routes.users import users_bp
    from .routes.scan import scan_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(rounds_bp, url_prefix='/api')
    app.register_blueprint(emails_bp, url_prefix='/api')
    app.register_blueprint(logs_bp, url_prefix='/api')
    app.register_blueprint(costs_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')
    app.register_blueprint(extension_bp, url_prefix='/api')
    app.register_blueprint(users_bp, url_prefix='/api')
    app.register_blueprint(scan_bp, url_prefix='/api')
