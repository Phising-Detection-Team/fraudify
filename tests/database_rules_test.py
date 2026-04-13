"""
Smoke tests: Verify database cannot be compromised.

Tests that all validation & constraints work (ORM-level and DB-level).
Runs against an in-memory SQLite database — no PostgreSQL required.
"""

import pytest
import os
import sys

# Add backend to path (needed when running this file in isolation)
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from datetime import datetime
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.models import db as _db
from app.models.email import Email
from app.models.round import Round
from app.models.log import Log
from app.models.api import API
from app.models.override import Override


# ============================================================================
# Fixtures — self-contained SQLite, no conftest.py dependency
# ============================================================================

@pytest.fixture(scope='module')
def app():
    """Flask app with in-memory SQLite. Tables created once per module."""
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(scope='function')
def db(app):
    """Clean database session for each test. All data wiped after each test."""
    with app.app_context():
        yield _db
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


# ============================================================================
# TEST 1: Confidence range (0–1 only)
# ============================================================================

def test_confidence_valid_accepted(db):
    """detector_confidence=0.95 should be accepted and stored correctly."""
    round_obj = Round(
        status='pending', total_emails=1, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    email = Email(
        round_id=round_obj.id,
        generated_content='Test email',
        generated_email_metadata={'sender': 'test@test.com'},
        is_phishing=True,
        detector_verdict='phishing',
        detector_confidence=0.95,
        generator_latency_ms=100,
        detector_latency_ms=50,
        cost=0.01
    )
    db.session.add(email)
    db.session.commit()
    assert email.detector_confidence == 0.95


def test_confidence_out_of_range_rejected(db):
    """detector_confidence=1.5 should be rejected by the ORM validator."""
    round_obj = Round(
        status='pending', total_emails=1, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    with pytest.raises((ValueError, IntegrityError)):
        Email(
            round_id=round_obj.id,
            generated_content='Test email',
            generated_email_metadata={'sender': 'test@test.com'},
            is_phishing=True,
            detector_verdict='phishing',
            detector_confidence=1.5,
            generator_latency_ms=100,
            detector_latency_ms=50,
            cost=0.01
        )


# ============================================================================
# TEST 2: Processed emails cannot exceed total
# ============================================================================

def test_processed_emails_valid(db):
    """processed_emails=5 of total_emails=10 should be accepted."""
    round_obj = Round(
        status='pending', total_emails=10, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    round_obj.processed_emails = 5
    db.session.commit()
    assert round_obj.processed_emails == 5


def test_processed_emails_exceeds_total_rejected(db):
    """processed_emails=15 when total_emails=10 should be rejected."""
    round_obj = Round(
        status='pending', total_emails=10, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    with pytest.raises((ValueError, IntegrityError)):
        round_obj.processed_emails = 15
        db.session.commit()


# ============================================================================
# TEST 3: Enum validation (status, level, agent_type, verdict)
# ============================================================================

def test_round_status_and_log_level_valid(db):
    """Status 'running' and log level 'warning' should be accepted."""
    round_obj = Round(
        status='running', total_emails=1, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()
    assert round_obj.status == 'running'

    log = Log(
        timestamp=datetime.utcnow(), level='warning',
        message='Test', round_id=round_obj.id
    )
    db.session.add(log)
    db.session.commit()
    assert log.level == 'warning'


def test_invalid_status_rejected(db):
    """status='invalid_status' should be rejected by the ORM validator."""
    with pytest.raises((ValueError, AssertionError)):
        Round(
            status='invalid_status', total_emails=1, processed_emails=0,
            started_at=datetime.utcnow(), completed_at=datetime.utcnow()
        )


# ============================================================================
# TEST 4: Negative values rejected (latency)
# ============================================================================

def test_negative_latency_rejected(db):
    """generator_latency_ms=-100 should be rejected by the ORM validator."""
    round_obj = Round(
        status='pending', total_emails=1, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    with pytest.raises((ValueError, IntegrityError)):
        Email(
            round_id=round_obj.id,
            generated_content='Test',
            generated_email_metadata={'sender': 'test@test.com'},
            is_phishing=True,
            detector_verdict='phishing',
            detector_confidence=0.5,
            generator_latency_ms=-100,
            detector_latency_ms=50,
            cost=0.01
        )


# ============================================================================
# TEST 5: Unique constraint on Override.email_id
# ============================================================================

def test_override_unique_constraint(db):
    """Only one Override per email_id allowed; duplicate should raise IntegrityError."""
    round_obj = Round(
        status='pending', total_emails=2, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    email1 = Email(
        round_id=round_obj.id,
        generated_content='Test Email 1',
        generated_email_metadata={'sender': 'test@test.com'},
        is_phishing=True,
        detector_verdict='phishing',
        detector_confidence=0.5,
        generator_latency_ms=100,
        detector_latency_ms=50,
        cost=0.01
    )
    db.session.add(email1)
    db.session.commit()

    # First override should succeed
    override1 = Override(email_id=email1.id, verdict='phishing')
    db.session.add(override1)
    db.session.commit()

    # Duplicate override on same email_id must fail
    override2 = Override(email_id=email1.id, verdict='phishing')
    db.session.add(override2)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


# ============================================================================
# TEST 6: API agent type validation
# ============================================================================

def test_api_agent_types_valid(db):
    """All three agent types (generator, detector, judge) should be accepted."""
    round_obj = Round(
        status='pending', total_emails=1, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    email = Email(
        round_id=round_obj.id,
        generated_content='Test Email',
        generated_email_metadata={'sender': 'test@test.com'},
        is_phishing=True,
        detector_verdict='phishing',
        detector_confidence=0.5,
        generator_latency_ms=100,
        detector_latency_ms=50,
        cost=0.01
    )
    db.session.add(email)
    db.session.commit()

    for agent in ['generator', 'detector', 'judge']:
        api_call = API(
            round_id=round_obj.id,
            email_id=email.id,
            agent_type=agent,
            token_used=100,
            latency_ms=50,
            cost=0.001
        )
        db.session.add(api_call)
        db.session.commit()


def test_api_invalid_agent_type_rejected(db):
    """agent_type='invalid_agent' should be rejected by the ORM validator."""
    round_obj = Round(
        status='pending', total_emails=1, processed_emails=0,
        started_at=datetime.utcnow(), completed_at=datetime.utcnow()
    )
    db.session.add(round_obj)
    db.session.commit()

    with pytest.raises((ValueError, IntegrityError)):
        API(
            round_id=round_obj.id,
            agent_type='invalid_agent',
            token_used=100,
            latency_ms=50,
            cost=0.001
        )
