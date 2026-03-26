"""
Shared pytest fixtures for the phishing detection test suite.
"""

import pytest
import sys
import os
from datetime import datetime

# Add necessary paths to sys.path for imports
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKEND_PATH = os.path.join(PROJECT_ROOT, 'backend')
LLMS_PATH = os.path.join(PROJECT_ROOT, 'LLMs')

for path in [PROJECT_ROOT, BACKEND_PATH, LLMS_PATH]:
    if path not in sys.path:
        sys.path.insert(0, path)

from app import create_app
from app.models import db as _db, Round, Email, Log, API, Override, User, Role, InviteCode


@pytest.fixture(scope='session')
def app():
    """
    Create Flask app with in-memory SQLite for the entire test session.
    Tables are created once and dropped after all tests complete.
    """
    app = create_app('testing')
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope='function')
def db(app):
    """
    Provide a clean database session for each test.
    Deletes all data after each test to ensure isolation.
    """
    with app.app_context():
        yield _db
        # Delete all data after each test for complete isolation
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


@pytest.fixture(scope='function')
def client(app):
    """Flask test client for making HTTP requests in API tests."""
    return app.test_client()


@pytest.fixture
def sample_round(db):
    """Create a minimal valid Round for testing."""
    round_obj = Round(
        status='running',
        total_emails=10,
        processed_emails=0,
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()
    return round_obj


@pytest.fixture
def sample_email(db, sample_round):
    """Create a minimal valid Email for testing."""
    email_obj = Email(
        round_id=sample_round.id,
        generated_content='Test email content',
        is_phishing=True,
        generated_email_metadata={'verdict': 'SCAM'},
        detector_verdict='phishing',
        detector_confidence=0.9,
        detector_risk_score=0.85
    )
    db.session.add(email_obj)
    db.session.commit()
    return email_obj


@pytest.fixture
def sample_log(db, sample_round):
    """Create a minimal valid Log entry for testing."""
    log_obj = Log(
        round_id=sample_round.id,
        level='info',
        message='Test log message',
        context={'test': 'context'}
    )
    db.session.add(log_obj)
    db.session.commit()
    return log_obj


@pytest.fixture
def sample_api_call(db, sample_round, sample_email):
    """Create a minimal valid API call entry for testing."""
    api_call = API(
        round_id=sample_round.id,
        email_id=sample_email.id,
        agent_type='generator',
        model_name='gpt-4o-mini',
        token_used=100,
        cost=0.001,
        latency_ms=1000
    )
    db.session.add(api_call)
    db.session.commit()
    return api_call


@pytest.fixture
def sample_override(db, sample_email):
    """Create a minimal valid Override entry for testing."""
    override_obj = Override(
        email_id=sample_email.id,
        verdict='correct',
        overridden_by='test_analyst',
        reason='Test override'
    )
    db.session.add(override_obj)
    db.session.commit()
    return override_obj


# ---------------------------------------------------------------------------
# Auth fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_role_user(db):
    """Create the 'user' role."""
    role = Role(name='user', description='Standard user')
    db.session.add(role)
    db.session.commit()
    return role


@pytest.fixture
def sample_role_admin(db):
    """Create the 'admin' role."""
    role = Role(name='admin', description='Administrator')
    db.session.add(role)
    db.session.commit()
    return role


@pytest.fixture
def sample_role_super_admin(db):
    """Create the 'super_admin' role."""
    role = Role(name='super_admin', description='Super administrator')
    db.session.add(role)
    db.session.commit()
    return role


@pytest.fixture
def sample_user(db, sample_role_user):
    """Create a regular user with hashed password."""
    user = User(email='user@example.com', username='testuser')
    user.set_password('Password1')
    user.roles.append(sample_role_user)
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def sample_admin(db, sample_role_admin):
    """Create an admin user."""
    user = User(email='admin@example.com', username='testadmin')
    user.set_password('Admin123')
    user.roles.append(sample_role_admin)
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def sample_invite_code(db, sample_admin, sample_role_user):
    """Create a valid invite code that grants the 'user' role."""
    invite = InviteCode.generate(
        created_by=sample_admin.id,
        role_id=sample_role_user.id,
        expires_in_days=7,
    )
    db.session.add(invite)
    db.session.commit()
    return invite
