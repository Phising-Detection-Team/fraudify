"""Unit tests for /api/rounds endpoints."""

import json
import pytest
from datetime import datetime, timezone
from app.models import Round


class TestCreateRound:
    """POST /api/rounds - Start a new competition round."""

    def test_create_round_success(self, client, db):
        """Create a new round with valid input."""
        payload = {'total_emails': 10}
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['total_emails'] == 10
        assert data['data']['status'] == 'running'
        assert data['data']['processed_emails'] == 0

    def test_create_round_with_metadata(self, client, db):
        """Create a round with optional created_by and notes."""
        payload = {
            'total_emails': 5,
            'created_by': 'test_user',
            'notes': 'Test round'
        }
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 201
        data = response.get_json()
        assert data['data']['created_by'] == 'test_user'
        assert data['data']['notes'] == 'Test round'

    def test_create_round_missing_field(self, client, db):
        """Reject POST without total_emails."""
        payload = {}
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_create_round_invalid_type(self, client, db):
        """Reject non-integer total_emails."""
        payload = {'total_emails': 'abc'}
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_create_round_zero_emails(self, client, db):
        """Reject zero or negative total_emails."""
        payload = {'total_emails': 0}
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 400

    def test_create_round_negative_emails(self, client, db):
        """Reject negative total_emails."""
        payload = {'total_emails': -5}
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 400

    def test_create_round_conflict_running(self, client, db, sample_round):
        """Reject new round if one is already running."""
        payload = {'total_emails': 10}
        response = client.post('/api/rounds', json=payload)
        assert response.status_code == 409
        data = response.get_json()
        assert data['success'] is False
        assert 'already running' in data['error']['message']

    def test_create_round_invalid_json(self, client):
        """Reject invalid JSON body."""
        response = client.post('/api/rounds', data='not json', content_type='application/json')
        assert response.status_code == 400


class TestListRounds:
    """GET /api/rounds - List rounds with pagination and filters."""

    def test_list_rounds_empty(self, client, db):
        """List rounds when none exist."""
        response = client.get('/api/rounds')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['total'] == 0
        assert len(data['items']) == 0

    def test_list_rounds_with_data(self, client, db, sample_round):
        """List rounds with paginated data."""
        response = client.get('/api/rounds')
        assert response.status_code == 200
        data = response.get_json()
        assert data['total'] >= 1
        assert len(data['items']) >= 1
        assert data['items'][0]['id'] == sample_round.id

    def test_list_rounds_filter_status(self, client, db, sample_round):
        """Filter rounds by status."""
        response = client.get('/api/rounds?status=running')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['items']) >= 1
        assert all(r['status'] == 'running' for r in data['items'])

    def test_list_rounds_filter_status_invalid(self, client):
        """Reject invalid status filter."""
        response = client.get('/api/rounds?status=invalid')
        assert response.status_code == 400

    def test_list_rounds_filter_created_by(self, client, db):
        """Filter rounds by creator."""
        r1 = Round(
            status='completed',
            total_emails=5,
            processed_emails=5,
            started_at=datetime.now(timezone.utc),
            created_by='user_a'
        )
        r2 = Round(
            status='completed',
            total_emails=10,
            processed_emails=10,
            started_at=datetime.now(timezone.utc),
            created_by='user_b'
        )
        db.session.add_all([r1, r2])
        db.session.commit()

        response = client.get('/api/rounds?created_by=user_a')
        assert response.status_code == 200
        data = response.get_json()
        assert all(r['created_by'] == 'user_a' for r in data['items'])

    def test_list_rounds_sort_by_id_asc(self, client, db, sample_round):
        """Sort rounds by ID ascending."""
        response = client.get('/api/rounds?sort_by=id&order=asc')
        assert response.status_code == 200
        data = response.get_json()
        if len(data['items']) > 1:
            ids = [r['id'] for r in data['items']]
            assert ids == sorted(ids)

    def test_list_rounds_pagination(self, client, db):
        """Test pagination parameters."""
        response = client.get('/api/rounds?page=1&per_page=10')
        assert response.status_code == 200
        data = response.get_json()
        assert 'page' in data
        assert 'per_page' in data
        assert 'pages' in data
        assert 'has_next' in data
        assert 'has_prev' in data


class TestGetRound:
    """GET /api/rounds/<id> - Get a single round with metrics."""

    def test_get_round_success(self, client, sample_round):
        """Retrieve an existing round."""
        response = client.get(f'/api/rounds/{sample_round.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['id'] == sample_round.id
        assert 'email_count' in data['data']
        assert 'live_accuracy' in data['data']

    def test_get_round_not_found(self, client):
        """Return 404 for non-existent round."""
        response = client.get('/api/rounds/9999')
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False

    def test_get_round_with_emails(self, client, db, sample_round, sample_email):
        """Round includes computed email_count and accuracy."""
        response = client.get(f'/api/rounds/{sample_round.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['email_count'] >= 1


class TestRunRound:
    """POST /api/rounds/<id>/run - Trigger AI orchestration."""

    def test_run_round_no_kernel(self, client, sample_round):
        """Reject if Semantic Kernel not initialized."""
        response = client.post(f'/api/rounds/{sample_round.id}/run')
        # SK_KERNEL is not in config, so this should return 400
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'Semantic Kernel' in data['error']['message']

    def test_run_round_wrong_status(self, client, db):
        """Reject if round is not in 'running' status."""
        completed_round = Round(
            status='completed',
            total_emails=5,
            processed_emails=5,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        db.session.add(completed_round)
        db.session.commit()

        response = client.post(f'/api/rounds/{completed_round.id}/run')
        assert response.status_code == 409
        data = response.get_json()
        assert data['success'] is False

    def test_run_round_not_found(self, client):
        """Return 404 for non-existent round."""
        response = client.post('/api/rounds/9999/run')
        assert response.status_code == 404
