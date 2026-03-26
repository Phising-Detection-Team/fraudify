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
