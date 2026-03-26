"""
Migration integration tests.

Verifies that the full Alembic migration chain (upgrade head → downgrade base)
runs without errors and produces the expected schema on a real PostgreSQL database.

These tests are SKIPPED when MIGRATION_DATABASE_URL is not set or doesn't point
to PostgreSQL — so local development with SQLite still works normally.

In CI, the 'phishing_test_db_migrations' database is created before this suite
runs, and MIGRATION_DATABASE_URL is set in the workflow env block.
"""

import os

import pytest
from sqlalchemy import create_engine, inspect, text

# ---------------------------------------------------------------------------
# Skip guard — entire module is skipped unless a PostgreSQL URL is provided
# ---------------------------------------------------------------------------

MIGRATION_DB_URL = os.environ.get('MIGRATION_DATABASE_URL', '')

pytestmark = pytest.mark.skipif(
    not MIGRATION_DB_URL or 'postgresql' not in MIGRATION_DB_URL,
    reason='Migration tests require MIGRATION_DATABASE_URL pointing to PostgreSQL',
)

# Path to the migrations directory (backend/migrations/) — absolute so it works
# regardless of the current working directory when pytest is invoked.
_MIGRATIONS_DIR = os.path.join(
    os.path.dirname(__file__), '..', 'backend', 'migrations'
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='module')
def migration_app():
    """
    Flask app instance wired to MIGRATION_DATABASE_URL.

    Does NOT call db.create_all() — migrations own the schema here.
    The URL is injected directly into app.config so env.py (via current_app)
    picks it up without needing to manipulate os.environ.
    """
    from app import create_app

    app = create_app('testing')
    # Override the URI so both Flask-SQLAlchemy and Alembic env.py (via
    # current_app.config) use the dedicated migration test database.
    app.config['SQLALCHEMY_DATABASE_URI'] = MIGRATION_DB_URL
    return app


@pytest.fixture(scope='module')
def upgraded_db(migration_app):
    """
    Runs 'flask db downgrade base' (to clear any stale state), then
    'flask db upgrade head'.  Yields a SQLAlchemy Inspector for the live
    database.  Runs 'flask db downgrade base' again on teardown so the
    database is clean for the next run.
    """
    from flask_migrate import upgrade, downgrade

    with migration_app.app_context():
        # Clean slate — ignore errors if there is nothing to downgrade
        try:
            downgrade(directory=_MIGRATIONS_DIR, revision='base')
        except Exception:
            pass

        upgrade(directory=_MIGRATIONS_DIR)

        engine = create_engine(MIGRATION_DB_URL)
        inspector = inspect(engine)
        yield inspector
        engine.dispose()

        # Teardown — leave the database empty for future runs
        try:
            downgrade(directory=_MIGRATIONS_DIR, revision='base')
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _column_names(inspector, table):
    return {col['name'] for col in inspector.get_columns(table)}


# ---------------------------------------------------------------------------
# TestMigrationUpgrade — all assertions run against the upgraded database
# ---------------------------------------------------------------------------

class TestMigrationUpgrade:
    """Schema verification after 'flask db upgrade head'."""

    def test_upgrade_head_succeeds(self, upgraded_db):
        """If the fixture ran without exception, upgrade succeeded."""
        # The fixture would have raised before yielding if upgrade failed.
        assert upgraded_db is not None

    # --- core tables --------------------------------------------------------

    def test_core_tables_exist(self, upgraded_db):
        tables = upgraded_db.get_table_names()
        for expected in ('rounds', 'emails', 'logs', 'api_calls', 'overrides'):
            assert expected in tables, f"Missing core table: {expected}"

    # --- auth tables --------------------------------------------------------

    def test_auth_tables_exist(self, upgraded_db):
        tables = upgraded_db.get_table_names()
        for expected in ('users', 'roles', 'user_roles', 'invite_codes', 'training_data_logs'):
            assert expected in tables, f"Missing auth table: {expected}"

    # --- emails schema ------------------------------------------------------

    def test_emails_created_by_is_integer(self, upgraded_db):
        """emails.created_by must be INTEGER (FK to users), not VARCHAR."""
        cols = {col['name']: col for col in upgraded_db.get_columns('emails')}
        assert 'created_by' in cols, "emails.created_by column missing"
        col_type = str(cols['created_by']['type']).upper()
        assert 'INT' in col_type, (
            f"emails.created_by expected INTEGER, got {col_type}"
        )

    def test_emails_training_data_ingested_exists(self, upgraded_db):
        cols = _column_names(upgraded_db, 'emails')
        assert 'training_data_ingested' in cols

    # --- users schema -------------------------------------------------------

    def test_users_key_columns(self, upgraded_db):
        cols = _column_names(upgraded_db, 'users')
        for expected in ('id', 'email', 'username', 'password_hash', 'is_active', 'email_verified'):
            assert expected in cols, f"Missing column users.{expected}"

    # --- user_roles join table ----------------------------------------------

    def test_user_roles_join_columns(self, upgraded_db):
        cols = _column_names(upgraded_db, 'user_roles')
        assert 'user_id' in cols
        assert 'role_id' in cols

    # --- invite_codes schema ------------------------------------------------

    def test_invite_codes_expiry_columns(self, upgraded_db):
        cols = _column_names(upgraded_db, 'invite_codes')
        for expected in ('code', 'expires_at', 'used_by', 'used_at'):
            assert expected in cols, f"Missing column invite_codes.{expected}"


# ---------------------------------------------------------------------------
# TestMigrationDowngrade — verifies the downgrade path is complete
# ---------------------------------------------------------------------------

class TestMigrationDowngrade:
    """Verify that 'flask db downgrade base' fully reverses the schema."""

    @pytest.fixture(autouse=True, scope='class')
    def full_cycle(self, migration_app):
        """
        Runs upgrade head then downgrade base for the downgrade tests.
        Uses a fresh context so it doesn't share state with `upgraded_db`.
        """
        from flask_migrate import upgrade, downgrade

        with migration_app.app_context():
            try:
                downgrade(directory=_MIGRATIONS_DIR, revision='base')
            except Exception:
                pass

            upgrade(directory=_MIGRATIONS_DIR)
            downgrade(directory=_MIGRATIONS_DIR, revision='base')

        yield

    def test_downgrade_base_succeeds(self, full_cycle):
        """If the fixture completed without exception, downgrade succeeded."""
        assert True  # fixture would have raised on failure

    def test_no_user_tables_after_downgrade(self, full_cycle):
        """After downgrade base, no application tables should remain."""
        engine = create_engine(MIGRATION_DB_URL)
        try:
            inspector = inspect(engine)
            tables = [t for t in inspector.get_table_names() if t != 'alembic_version']
            assert tables == [], (
                f"Tables still present after downgrade base: {tables}"
            )
        finally:
            engine.dispose()
