"""
Application configuration for different environments.

Loads environment variables from .env file for safety and easy recall.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

env_file = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    env_file_backend = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_file_backend):
        load_dotenv(env_file_backend)


class BaseConfig:
    """Base configuration shared across all environments."""

    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = False
    TESTING = False

    # SQLAlchemy
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        os.environ.get('DEV_DATABASE_URL', os.environ.get('PROD_DATABASE_URL', 'sqlite:///app.db'))
    )
    SQLALCHEMY_ECHO = os.environ.get('SQLALCHEMY_ECHO', 'False').lower() == 'true'

    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    JSON_SORT_KEYS = False

    # Session
    PERMANENT_SESSION_LIFETIME = timedelta(
        days=int(os.environ.get('SESSION_LIFETIME_DAYS', 7))
    )
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')

    # Application Settings
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB

    # Redis
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

    # Scan result cache TTL in seconds (default 1 hour)
    SCAN_CACHE_TTL = int(os.environ.get('SCAN_CACHE_TTL', 3600))

    # Celery broker transport options — retry on transient Redis connection resets
    BROKER_TRANSPORT_OPTIONS = {
        'max_retries': 5,
        'interval_start': 0.2,
        'interval_step': 0.5,
        'interval_max': 3.0,
        'socket_keepalive': True,
    }

    # Google Gemini API
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

    # Semantic Kernel / OpenAI
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
    OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

    # JWT (Flask-JWT-Extended)
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Rate limiting (Flask-Limiter backed by Redis)
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    RATELIMIT_DEFAULT = '60 per minute'

    # OpenAI Agents SDK orchestrator (POST /api/rounds/<id>/run)
    ORCHESTRATION_PARALLEL_WORKFLOWS = int(os.environ.get('ORCHESTRATION_PARALLEL_WORKFLOWS', '2'))

    # Flask-Mail
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@sentra.app')

    # Frontend base URL (used to build links in emails)
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

    # Password reset token expiry
    PASSWORD_RESET_EXPIRY_HOURS = int(os.environ.get('PASSWORD_RESET_EXPIRY_HOURS', 1))


class DevelopmentConfig(BaseConfig):
    """Development configuration."""

    DEBUG = True
    SQLALCHEMY_ECHO = True
    SESSION_COOKIE_SECURE = False

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DEV_DATABASE_URL',
        'sqlite:///app.db'
    )


class TestingConfig(BaseConfig):
    """Testing configuration with in-memory SQLite."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///:memory:'
    )
    SQLALCHEMY_ECHO = False
    WTF_CSRF_ENABLED = False
    SERVER_NAME = os.environ.get('TEST_SERVER_NAME', 'localhost')
    # Use memory storage for rate limiter in tests (no Redis needed)
    RATELIMIT_STORAGE_URI = 'memory://'
    RATELIMIT_ENABLED = False
    # Run Celery tasks synchronously in tests (no broker/Redis needed)
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = False
    CELERY_RESULT_BACKEND = 'cache+memory://'


class ProductionConfig(BaseConfig):
    """Production configuration."""

    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'PROD_DATABASE_URL',
        'postgresql://localhost/phishing_db'
    )

    def __init__(self):
        if 'DATABASE_URL' not in os.environ and 'PROD_DATABASE_URL' not in os.environ:
            raise ValueError('DATABASE_URL or PROD_DATABASE_URL must be set in production')
        if self.SQLALCHEMY_DATABASE_URI.startswith('sqlite'):
            raise ValueError('SQLite is not allowed in production. Use PostgreSQL via DATABASE_URL.')


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}


def get_config(env=None):
    """
    Get configuration based on environment.

    Args:
        env: Environment name ('development', 'testing', 'production')
             Defaults to FLASK_ENV from .env or 'development'

    Returns:
        Configuration class
    """
    if env is None:
        env = os.environ.get('FLASK_ENV', 'development')

    selected = config.get(env, DevelopmentConfig)

    if selected == ProductionConfig:
        if not os.environ.get('SECRET_KEY') or os.environ.get('SECRET_KEY') == 'dev-secret-key-change-in-production':
            raise ValueError('SECRET_KEY must be set in .env for production')

    return selected
