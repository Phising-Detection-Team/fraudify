"""Unit tests for /api/costs endpoints."""

import json
import pytest
from datetime import datetime, timezone
from app.models import API, Round, Email


class TestGetCosts:
    """GET /api/costs - Get cost breakdown and analytics."""

    def test_get_costs_empty_database(self, client, db):
        """Get costs when no API calls exist."""
        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['total_cost'] == 0.0
        assert data['data']['total_tokens'] == 0
        assert data['data']['total_api_calls'] == 0

    def test_get_costs_with_data(self, client, sample_api_call):
        """Get costs with API call data."""
        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['total_cost'] > 0.0
        assert data['data']['total_tokens'] > 0
        assert data['data']['total_api_calls'] >= 1

    def test_get_costs_response_structure(self, client, sample_api_call):
        """Verify response has all expected fields."""
        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()
        assert 'success' in data
        assert 'data' in data

        cost_data = data['data']
        assert 'total_cost' in cost_data
        assert 'total_tokens' in cost_data
        assert 'total_api_calls' in cost_data
        assert 'avg_cost_per_email' in cost_data
        assert 'by_agent' in cost_data
        assert 'by_round' in cost_data
        assert 'by_model' in cost_data

    def test_get_costs_by_agent(self, client, db, sample_round, sample_email):
        """Cost breakdown by agent type."""
        # Create calls for different agent types
        api_call_gen = API(
            round_id=sample_round.id,
            email_id=sample_email.id,
            agent_type='generator',
            model_name='gpt-4o-mini',
            token_used=500,
            cost=0.005
        )
        api_call_det = API(
            round_id=sample_round.id,
            email_id=sample_email.id,
            agent_type='detector',
            model_name='gpt-4o-mini',
            token_used=300,
            cost=0.003
        )
        db.session.add_all([api_call_gen, api_call_det])
        db.session.commit()

        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()
        by_agent = data['data']['by_agent']

        agent_types = {item['agent_type'] for item in by_agent}
        assert 'generator' in agent_types
        assert 'detector' in agent_types

        # Verify agent details
        for agent in by_agent:
            assert 'agent_type' in agent
            assert 'total_cost' in agent
            assert 'total_tokens' in agent
            assert 'call_count' in agent

    def test_get_costs_by_round(self, client, db, sample_round, sample_api_call):
        """Cost breakdown by round."""
        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()
        by_round = data['data']['by_round']

        assert len(by_round) >= 1
        for round_info in by_round:
            assert 'round_id' in round_info
            assert 'total_cost' in round_info
            assert 'total_tokens' in round_info
            assert 'call_count' in round_info

    def test_get_costs_by_model(self, client, db, sample_round, sample_email):
        """Cost breakdown by model."""
        api_call1 = API(
            round_id=sample_round.id,
            email_id=sample_email.id,
            agent_type='generator',
            model_name='gpt-4o-mini',
            token_used=100,
            cost=0.001
        )
        api_call2 = API(
            round_id=sample_round.id,
            email_id=sample_email.id,
            agent_type='detector',
            model_name='gpt-4o',
            token_used=200,
            cost=0.002
        )
        db.session.add_all([api_call1, api_call2])
        db.session.commit()

        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()
        by_model = data['data']['by_model']

        models = {item['model_name'] for item in by_model}
        assert 'gpt-4o-mini' in models or 'gpt-4o' in models

        for model_info in by_model:
            assert 'model_name' in model_info
            assert 'total_cost' in model_info
            assert 'total_tokens' in model_info
            assert 'call_count' in model_info

    def test_get_costs_filter_by_round(self, client, db):
        """Filter costs by specific round."""
        r1 = Round(
            status='completed',
            total_emails=5,
            processed_emails=5,
            started_at=datetime.now(timezone.utc),
            total_cost=0.01
        )
        r2 = Round(
            status='completed',
            total_emails=10,
            processed_emails=10,
            started_at=datetime.now(timezone.utc),
            total_cost=0.02
        )
        db.session.add_all([r1, r2])
        db.session.commit()

        e1 = Email(
            round_id=r1.id,
            generated_content='Email 1',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='phishing'
        )
        e2 = Email(
            round_id=r2.id,
            generated_content='Email 2',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='phishing'
        )
        db.session.add_all([e1, e2])
        db.session.commit()

        api1 = API(
            round_id=r1.id,
            email_id=e1.id,
            agent_type='generator',
            model_name='gpt-4o-mini',
            token_used=100,
            cost=0.001
        )
        api2 = API(
            round_id=r2.id,
            email_id=e2.id,
            agent_type='generator',
            model_name='gpt-4o-mini',
            token_used=200,
            cost=0.002
        )
        db.session.add_all([api1, api2])
        db.session.commit()

        response = client.get(f'/api/costs?round_id={r1.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['total_cost'] == 0.001

    def test_get_costs_filter_round_invalid_type(self, client):
        """Reject non-integer round_id."""
        response = client.get('/api/costs?round_id=abc')
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_get_costs_average_per_email(self, client, db):
        """Verify avg_cost_per_email calculation."""
        round_obj = Round(
            status='completed',
            total_emails=10,
            processed_emails=10,
            started_at=datetime.now(timezone.utc),
            total_cost=0.01
        )
        db.session.add(round_obj)
        db.session.commit()

        email = Email(
            round_id=round_obj.id,
            generated_content='Test',
            is_phishing=True,
            generated_email_metadata={},
            detector_verdict='phishing'
        )
        db.session.add(email)
        db.session.commit()

        api_call = API(
            round_id=round_obj.id,
            email_id=email.id,
            agent_type='generator',
            model_name='gpt-4o-mini',
            token_used=100,
            cost=0.01
        )
        db.session.add(api_call)
        db.session.commit()

        response = client.get(f'/api/costs?round_id={round_obj.id}')
        assert response.status_code == 200
        data = response.get_json()
        # avg_cost_per_email = total_cost / processed_emails
        avg = data['data']['avg_cost_per_email']
        expected = 0.01 / 10
        assert abs(avg - expected) < 0.0001

    def test_get_costs_no_emails_zero_avg(self, client, db):
        """Avg cost per email is 0 when no emails processed."""
        round_obj = Round(
            status='running',
            total_emails=1,
            processed_emails=0,
            started_at=datetime.now(timezone.utc)
        )
        db.session.add(round_obj)
        db.session.commit()

        response = client.get(f'/api/costs?round_id={round_obj.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['avg_cost_per_email'] == 0

    def test_get_costs_numeric_types(self, client, sample_api_call):
        """Verify numeric types in response."""
        response = client.get('/api/costs')
        assert response.status_code == 200
        data = response.get_json()

        # Costs should be floats
        assert isinstance(data['data']['total_cost'], (int, float))
        assert isinstance(data['data']['avg_cost_per_email'], (int, float))

        # Tokens should be integers
        assert isinstance(data['data']['total_tokens'], int)
        assert isinstance(data['data']['total_api_calls'], int)

        # By-agent items should also have correct types
        for agent in data['data']['by_agent']:
            assert isinstance(agent['total_cost'], (int, float))
            assert isinstance(agent['total_tokens'], int)
            assert isinstance(agent['call_count'], int)
