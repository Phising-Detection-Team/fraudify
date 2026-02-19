import os


class BaseConfig:
    """Base configuration shared across all environments."""

    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    CORS_ORIGINS = '*'
    JSON_SORT_KEYS = False


class DevelopmentConfig(BaseConfig):
    """Development configuration."""

    DEBUG = True
    TESTING = False


class TestingConfig(BaseConfig):
    """Testing configuration with in-memory SQLite."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ECHO = False


class ProductionConfig(BaseConfig):
    """Production configuration."""

    DEBUG = False
    TESTING = False

    def __init__(self):
        # Ensure DATABASE_URL is set and uses PostgreSQL in production
        if 'DATABASE_URL' not in os.environ:
            raise ValueError('DATABASE_URL environment variable must be set in production')
        if self.SQLALCHEMY_DATABASE_URI.startswith('sqlite'):
            raise ValueError('SQLite is not allowed in production. Use PostgreSQL via DATABASE_URL.')


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
