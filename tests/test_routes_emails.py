"""Unit tests for /api/emails endpoints."""

import json
import pytest
from datetime import datetime, timezone
from app.models import Email, Override


class TestListEmailsByRound:
    """GET /api/rounds/<id>/emails - List emails in a round."""

    def test_list_emails_success(self, client, sample_round, sample_email):
        """List emails belonging to a round."""
        response = client.get(f'/api/rounds/{sample_round.id}/emails')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'items' in data
        assert len(data['items']) >= 1
        assert data['items'][0]['id'] == sample_email.id

    def test_list_emails_empty_round(self, client, db):
        """List emails from round with no emails."""
        from app.models import Round
        empty_round = Round(
            status='completed',
            total_emails=1,
            processed_emails=0,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        db.session.add(empty_round)
        db.session.commit()

        response = client.get(f'/api/rounds/{empty_round.id}/emails')
        assert response.status_code == 200
        data = response.get_json()
        assert data['items'] == []

    def test_list_emails_round_not_found(self, client):
        """Return 404 for non-existent round."""
        response = client.get('/api/rounds/9999/emails')
        assert response.status_code == 404

    def test_list_emails_filter_verdict_phishing(self, client, sample_round, sample_email, db):
        """Filter emails by verdict=phishing."""
        # sample_email already has detector_verdict='phishing'
        response = client.get(f'/api/rounds/{sample_round.id}/emails?verdict=phishing')
        assert response.status_code == 200
        data = response.get_json()
        assert all(e['detector_verdict'] == 'phishing' for e in data['items'])

    def test_list_emails_filter_verdict_legitimate(self, client, sample_round, db):
        """Filter emails by verdict=legitimate."""
        legitimate_email = Email(
            round_id=sample_round.id,
            generated_content='Legit email',
            is_phishing=False,
            generated_email_metadata={},
            detector_verdict='legitimate',
            detector_confidence=0.95
        )
        db.session.add(legitimate_email)
        db.session.commit()

        response = client.get(f'/api/rounds/{sample_round.id}/emails?verdict=legitimate')
        assert response.status_code == 200
        data = response.get_json()
        assert all(e['detector_verdict'] == 'legitimate' for e in data['items'])

    def test_list_emails_filter_verdict_invalid(self, client, sample_round):
        """Reject invalid verdict filter."""
        response = client.get(f'/api/rounds/{sample_round.id}/emails?verdict=invalid')
        assert response.status_code == 400

    def test_list_emails_filter_overridden(self, client, sample_round, sample_email, db):
        """Filter by overridden status."""
        # Create an override for sample_email
        from app.models import Override
        override = Override(
            email_id=sample_email.id,
            verdict='correct'
        )
        db.session.add(override)
        sample_email.manual_override = True
        db.session.commit()

        response = client.get(f'/api/rounds/{sample_round.id}/emails?overridden=true')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['items']) >= 1

    def test_list_emails_pagination(self, client, sample_round, sample_email):
        """Test pagination parameters."""
        response = client.get(f'/api/rounds/{sample_round.id}/emails?page=1&per_page=10')
        assert response.status_code == 200
        data = response.get_json()
        assert 'page' in data
        assert 'per_page' in data


class TestGetEmail:
    """GET /api/emails/<id> - Get a single email with all outputs."""

    def test_get_email_success(self, client, sample_email):
        """Retrieve a single email with full data."""
        response = client.get(f'/api/emails/{sample_email.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['id'] == sample_email.id
        assert 'generated_content' in data['data']
        assert 'detector_verdict' in data['data']
        assert 'override' in data['data']
        assert 'api_calls' in data['data']
        assert 'final_verdict' in data['data']

    def test_get_email_not_found(self, client):
        """Return 404 for non-existent email."""
        response = client.get('/api/emails/9999')
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False

    def test_get_email_with_override(self, client, sample_email, sample_override):
        """Email response includes override if present."""
        response = client.get(f'/api/emails/{sample_email.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['override'] is not None
        assert data['data']['override']['verdict'] == 'correct'

    def test_get_email_with_api_calls(self, client, sample_email, sample_api_call):
        """Email response includes api_calls if present."""
        response = client.get(f'/api/emails/{sample_email.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']['api_calls']) >= 1
        assert data['data']['api_calls'][0]['agent_type'] == 'generator'

    def test_get_email_false_positive(self, client, db, sample_round):
        """Email.is_false_positive() true when detector says phishing but is_phishing=False."""
        email = Email(
            round_id=sample_round.id,
            generated_content='Legit but flagged',
            is_phishing=False,  # Actually legitimate
            generated_email_metadata={},
            detector_verdict='phishing',  # But detector said phishing
            detector_confidence=0.9
        )
        db.session.add(email)
        db.session.commit()

        response = client.get(f'/api/emails/{email.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['is_false_positive'] is True

    def test_get_email_false_negative(self, client, db, sample_round):
        """Email.is_false_negative() true when detector says legitimate but is_phishing=True."""
        email = Email(
            round_id=sample_round.id,
            generated_content='Phishing that fooled detector',
            is_phishing=True,  # Actually phishing
            generated_email_metadata={},
            detector_verdict='legitimate',  # But detector missed it
            detector_confidence=0.2
        )
        db.session.add(email)
        db.session.commit()

        response = client.get(f'/api/emails/{email.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['is_false_negative'] is True


class TestCreateOverride:
    """POST /api/emails/<id>/override - Submit manual verdict correction."""

    def test_create_override_success(self, client, sample_email):
        """Create override with valid input."""
        payload = {
            'verdict': 'correct',
            'overridden_by': 'analyst_1',
            'reason': 'Confirmed phishing'
        }
        response = client.post(f'/api/emails/{sample_email.id}/override', json=payload)
        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['verdict'] == 'correct'
        assert data['data']['overridden_by'] == 'analyst_1'

    def test_create_override_verdict_types(self, client, sample_email, db, sample_round):
        """Test all valid verdict types."""
        verdicts = ['correct', 'incorrect', 'phishing', 'legitimate']
        for verdict in verdicts:
            email = Email(
                round_id=sample_round.id,
                generated_content=f'Test {verdict}',
                is_phishing=True,
                generated_email_metadata={},
                detector_verdict='phishing',
                detector_confidence=0.9
            )
            db.session.add(email)
            db.session.commit()

            payload = {'verdict': verdict}
            response = client.post(f'/api/emails/{email.id}/override', json=payload)
            assert response.status_code == 201

    def test_create_override_missing_verdict(self, client, sample_email):
        """Reject override without verdict."""
        payload = {}
        response = client.post(f'/api/emails/{sample_email.id}/override', json=payload)
        assert response.status_code == 400

    def test_create_override_invalid_verdict(self, client, sample_email):
        """Reject invalid verdict."""
        payload = {'verdict': 'maybe'}
        response = client.post(f'/api/emails/{sample_email.id}/override', json=payload)
        assert response.status_code == 400

    def test_create_override_conflict(self, client, sample_email, sample_override):
        """Reject if email already has override."""
        payload = {'verdict': 'incorrect'}
        response = client.post(f'/api/emails/{sample_email.id}/override', json=payload)
        assert response.status_code == 409
        data = response.get_json()
        assert 'already has an override' in data['error']['message']

    def test_create_override_email_not_found(self, client):
        """Return 404 for non-existent email."""
        payload = {'verdict': 'correct'}
        response = client.post('/api/emails/9999/override', json=payload)
        assert response.status_code == 404

    def test_create_override_updates_email(self, client, db, sample_email):
        """Creating override updates Email.manual_override and related fields."""
        payload = {
            'verdict': 'incorrect',
            'overridden_by': 'analyst_2',
            'reason': 'False positive'
        }
        response = client.post(f'/api/emails/{sample_email.id}/override', json=payload)
        assert response.status_code == 201

        # Verify email was updated
        updated_email = db.session.get(Email, sample_email.id)
        assert updated_email.manual_override is True
        assert updated_email.override_verdict == 'incorrect'
        assert updated_email.overridden_by == 'analyst_2'

    def test_create_override_updates_round_accuracy(self, client, db, sample_round, sample_email):
        """Creating override triggers round accuracy recalculation."""
        response = client.post(
            f'/api/emails/{sample_email.id}/override',
            json={'verdict': 'correct'}
        )
        assert response.status_code == 201
        data = response.get_json()
        # The endpoint returns round_accuracy_updated
        assert 'round_accuracy_updated' in data

        # Verify round was updated
        updated_round = db.session.get(type(sample_round), sample_round.id)
        assert updated_round.detector_accuracy is not None
