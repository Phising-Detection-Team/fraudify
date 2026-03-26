from logging.config import fileConfig
import os
import sys
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Load environment variables from .env files
from dotenv import load_dotenv

# Try loading from multiple locations
env_locations = [
    Path(__file__).parent.parent.parent / '.env',  # Root .env
    Path(__file__).parent.parent / '.env',         # backend/.env
]

for env_file in env_locations:
    if env_file.exists():
        load_dotenv(env_file)
        break

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Configure logging only if alembic.ini config file exists
if config.config_file_name:
    fileConfig(config.config_file_name)

# Resolve the database URL using the Flask app context when available (standard
# Flask-Migrate pattern), then fall back to environment variables, then alembic.ini.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models import db
from app.models.email import Email          # noqa: F401
from app.models.round import Round          # noqa: F401
from app.models.log import Log              # noqa: F401
from app.models.api import API              # noqa: F401
from app.models.override import Override    # noqa: F401
from app.models.user import User            # noqa: F401
from app.models.role import Role            # noqa: F401
from app.models.invite_code import InviteCode          # noqa: F401
from app.models.training_data_log import TrainingDataLog  # noqa: F401

target_metadata = db.Model.metadata

try:
    from flask import current_app
    db_url = current_app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('%', '%%')
    if db_url:
        config.set_main_option('sqlalchemy.url', db_url)
except RuntimeError:
    # No active Flask app context (e.g. running alembic CLI directly).
    # Fall back to environment variables, then the alembic.ini placeholder.
    database_url = (
        os.environ.get('DATABASE_URL')
        or os.environ.get('DEV_DATABASE_URL')
        or os.environ.get('PROD_DATABASE_URL')
    )
    if database_url:
        config.set_main_option('sqlalchemy.url', database_url)

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
