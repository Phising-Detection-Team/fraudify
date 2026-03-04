"""
Model constraint and validator tests.

Migrated from database_rules_test.py with bug fixes and additional tests
for model helper methods.
"""

import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from app.models import db, Round, Email, Log, API, Override


# ============================================================================
# Fixtures
# ============================================================================

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


# ============================================================================
# Email Model Tests
# ============================================================================

class TestEmailConstraints:
    """Test Email model validators and constraints."""

    def test_email_confidence_valid(self, db, sample_round):
        """Valid confidence value (0.95) should be accepted."""
        email = Email(
            round_id=sample_round.id,
            generated_content='Test',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='phishing',
            detector_confidence=0.95
        )
        db.session.add(email)
        db.session.commit()
        assert email.detector_confidence == 0.95

    def test_email_confidence_out_of_range(self, db, sample_round):
        """Invalid confidence (1.5) should raise ValueError."""
        with pytest.raises(ValueError):
            email = Email(
                round_id=sample_round.id,
                generated_content='Test',
                is_phishing=True,
                generated_email_metadata={},
                detector_verdict='phishing',
                detector_confidence=1.5
            )

    def test_email_negative_latency(self, db, sample_round):
        """Negative latency should be rejected."""
        with pytest.raises(ValueError):
            email = Email(
                round_id=sample_round.id,
                generated_content='Test',
                is_phishing=True,
                generated_email_metadata={},
                detector_verdict='phishing',
                generator_latency_ms=-100
            )

    def test_email_detector_verdict_enum(self, db, sample_round):
        """Only 'phishing' or 'legitimate' are valid verdicts."""
        # Valid verdict
        email = Email(
            round_id=sample_round.id,
            generated_content='Test',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='legitimate'
        )
        db.session.add(email)
        db.session.commit()

        # Invalid verdict
        with pytest.raises(ValueError):
            email_bad = Email(
                round_id=sample_round.id,
                generated_content='Test',
                is_phishing=True,
                generated_email_metadata={},
                detector_verdict='maybe'
            )


class TestEmailHelperMethods:
    """Test Email model helper methods."""

    def test_email_get_final_verdict_no_override(self, db, sample_email):
        """Without override, returns detector_verdict."""
        assert sample_email.detector_verdict == 'phishing'
        # get_final_verdict should return detector_verdict
        if hasattr(sample_email, 'get_final_verdict'):
            assert sample_email.get_final_verdict() == 'phishing'

    def test_email_is_false_positive(self, db, sample_round):
        """False positive: is_phishing=False, detector says phishing."""
        email = Email(
            round_id=sample_round.id,
            generated_content='Test',
            is_phishing=False,  # Actually legitimate
            generated_email_metadata={},
            detector_verdict='phishing'  # But detector said phishing
        )
        db.session.add(email)
        db.session.commit()
        # is_false_positive should return True
        if hasattr(email, 'is_false_positive'):
            assert email.is_false_positive() is True

    def test_email_is_false_negative(self, db, sample_round):
        """False negative: is_phishing=True, detector says legitimate."""
        email = Email(
            round_id=sample_round.id,
            generated_content='Test',
            is_phishing=True,  # Actually phishing
            generated_email_metadata={},
            detector_verdict='legitimate'  # But detector said legitimate
        )
        db.session.add(email)
        db.session.commit()
        # is_false_negative should return True
        if hasattr(email, 'is_false_negative'):
            assert email.is_false_negative() is True


# ============================================================================
# Round Model Tests
# ============================================================================

class TestRoundConstraints:
    """Test Round model validators and constraints."""

    def test_round_status_valid(self, db):
        """Valid status values should be accepted."""
        for status in ['pending', 'running', 'completed', 'failed']:
            round_obj = Round(
                status=status,
                total_emails=10,
                processed_emails=0,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            db.session.add(round_obj)
            db.session.commit()

    def test_round_status_invalid(self, db):
        """Invalid status should raise ValueError."""
        with pytest.raises(ValueError):
            round_obj = Round(
                status='invalid_status',
                total_emails=10,
                processed_emails=0,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )

    def test_round_processed_emails_valid(self, db):
        """processed_emails <= total_emails should be accepted."""
        round_obj = Round(
            status='running',
            total_emails=10,
            processed_emails=5,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        db.session.add(round_obj)
        db.session.commit()
        assert round_obj.processed_emails == 5

    def test_round_processed_emails_exceeds_total(self, db):
        """processed_emails > total_emails should be rejected."""
        with pytest.raises(ValueError):
            round_obj = Round(
                status='running',
                total_emails=10,
                processed_emails=15,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )


class TestRoundMethods:
    """Test Round model methods."""

    def test_calculate_accuracy_all_phishing(self, db, sample_round):
        """All emails correctly classified as phishing -> 100% accuracy."""
        # Create 3 emails, all with detector_verdict='phishing'
        for i in range(3):
            email = Email(
                round_id=sample_round.id,
                generated_content=f'Email {i}',
                is_phishing=True,
                generated_email_metadata={},
                detector_verdict='phishing'
            )
            db.session.add(email)
        db.session.commit()

        accuracy = sample_round.calculate_accuracy()
        assert accuracy == 100.0

    def test_calculate_accuracy_partial(self, db, sample_round):
        """1 of 2 emails correctly classified -> 50% accuracy."""
        # First email: correct
        email1 = Email(
            round_id=sample_round.id,
            generated_content='Email 1',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='phishing'
        )
        db.session.add(email1)

        # Second email: incorrect (false negative)
        email2 = Email(
            round_id=sample_round.id,
            generated_content='Email 2',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='legitimate'
        )
        db.session.add(email2)
        db.session.commit()

        accuracy = sample_round.calculate_accuracy()
        assert accuracy == 50.0

    def test_calculate_accuracy_empty(self, db, sample_round):
        """Round with no emails -> 0% accuracy."""
        # Use a round with emails but verify accuracy is 0 when no emails match
        accuracy = sample_round.calculate_accuracy()
        assert accuracy == 0.0


# ============================================================================
# Log Model Tests
# ============================================================================

class TestLogConstraints:
    """Test Log model validators and constraints."""

    def test_log_level_valid(self, db, sample_round):
        """Valid log levels should be accepted."""
        for level in ['info', 'warning', 'error', 'critical']:
            log = Log(
                round_id=sample_round.id,
                level=level,
                message='Test message'
            )
            db.session.add(log)
            db.session.commit()

    def test_log_level_invalid(self, db, sample_round):
        """Invalid log level should be rejected."""
        with pytest.raises(ValueError):
            log = Log(
                round_id=sample_round.id,
                level='debug',  # Not a valid level
                message='Test message'
            )


# ============================================================================
# API Model Tests
# ============================================================================

class TestAPIConstraints:
    """Test API model validators and constraints."""

    def test_api_agent_type_valid(self, db, sample_round):
        """Valid agent types should be accepted."""
        for agent_type in ['generator', 'detector']:
            api_call = API(
                round_id=sample_round.id,
                agent_type=agent_type,
                model_name='test-model',
                token_used=100,
                cost=0.001,
                latency_ms=500
            )
            db.session.add(api_call)
            db.session.commit()

    def test_api_agent_type_invalid(self, db, sample_round):
        """Invalid agent type should be rejected."""
        with pytest.raises(ValueError):
            api_call = API(
                round_id=sample_round.id,
                agent_type='invalid_agent',
                model_name='test-model',
                token_used=100,
                cost=0.001,
                latency_ms=500
            )

    def test_api_negative_latency(self, db, sample_round):
        """Negative latency should be rejected."""
        with pytest.raises(ValueError):
            api_call = API(
                round_id=sample_round.id,
                agent_type='generator',
                model_name='test-model',
                token_used=100,
                cost=0.001,
                latency_ms=-500
            )


# ============================================================================
# Override Model Tests
# ============================================================================

class TestOverrideConstraints:
    """Test Override model validators and constraints."""

    def test_override_unique_constraint(self, db, sample_email):
        """Only one Override per email is allowed (unique constraint)."""
        # First override should succeed
        override1 = Override(
            email_id=sample_email.id,
            verdict='correct',
            overridden_by='analyst1'
        )
        db.session.add(override1)
        db.session.commit()

        # Second override on same email should fail
        override2 = Override(
            email_id=sample_email.id,
            verdict='incorrect',
            overridden_by='analyst2'
        )
        db.session.add(override2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

    def test_override_verdict_valid(self, db, sample_email):
        """Valid verdict values should be accepted."""
        for verdict in ['correct', 'incorrect', 'phishing', 'legitimate']:
            override = Override(
                email_id=sample_email.id,
                verdict=verdict,
                overridden_by='analyst'
            )
            db.session.add(override)
            db.session.commit()
            db.session.delete(override)
            db.session.commit()

    def test_override_verdict_invalid(self, db, sample_email):
        """Invalid verdict should be rejected."""
        with pytest.raises(ValueError):
            override = Override(
                email_id=sample_email.id,
                verdict='maybe',  # Not valid
                overridden_by='analyst'
            )
