"""Flask application factory and initialization."""

import logging
from celery import Celery
from flask import Flask

# Forward INFO logs from the openai-agentic module to Flask's logger
logging.getLogger("entities.detector_agent_entity").setLevel(logging.INFO)
logging.getLogger("services.detector_agent_service").setLevel(logging.INFO)
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
        from .models.feedback import Feedback  # noqa: F401

    _register_socket_events(app)
    _register_blueprints(app)

    # Register CLI commands
    from .commands import seed_cmd
    app.cli.add_command(seed_cmd)

    return app


def _register_jwt_callbacks(app):
    """Set up JWT token-in-blocklist check via Redis."""

    if app.config.get('TESTING'):
        app.config['TEST_JWT_BLACKLIST'] = set()

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get('jti')
        if not jti:
            return False

        if app.config.get('TESTING'):
            return jti in app.config.get('TEST_JWT_BLACKLIST', set())

        import redis as redis_lib
        try:
            redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
            r = redis_lib.from_url(redis_url)
            return r.exists(f'jwt_blacklist:{jti}') == 1
        except Exception as e:
            app.logger.critical('JWT blacklist check failed: %s', e)
            # Fail closed: block access if we cannot verify the blacklist status.
            return True


def _register_socket_events(app):
    """Authenticate WebSocket connections and join user-specific rooms."""
    from flask import request
    from flask_socketio import join_room, disconnect
    from flask_jwt_extended import decode_token

    @socketio.on('connect')
    def handle_connect(auth):
        token = auth.get('token') if auth else None
        if not token:
            # Check query string if not in auth payload
            token = request.args.get('token')
            
        if not token:
            disconnect()
            return False

        try:
            # Decode the token
            decoded = decode_token(token)
            user_id = str(decoded['sub'])
            # Join a private room with the user's ID
            join_room(user_id)
        except Exception:
            disconnect()
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
    from .routes.feedback import feedback_bp

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
    app.register_blueprint(feedback_bp, url_prefix='/api')
