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
from app.models import db as _db, Round, Email


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
    Rolls back after the test to ensure isolation.
    """
    with app.app_context():
        yield _db
        _db.session.rollback()


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
