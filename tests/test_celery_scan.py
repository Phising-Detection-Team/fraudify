"""
Tests for Celery async scan endpoints.

TDD: Tests written BEFORE implementation.

Tests:
1. test_scan_returns_202_with_job_id       - POST /api/scan returns 202, response has job_id
2. test_scan_status_pending                - GET /api/scan/status/<id> returns pending for new task
3. test_scan_status_complete               - mock Celery result as SUCCESS, returns complete + verdict
4. test_scan_status_failed                 - mock Celery result as FAILURE, returns failed
5. test_scan_requires_auth                 - no token -> 401
6. test_scan_missing_body                  - missing body -> 400
7. test_scan_body_too_large                - body > 50KB -> 400
8. test_scan_task_executes                 - scan_email_task.apply() runs synchronously (CELERY_TASK_ALWAYS_EAGER)
9. test_scan_task_parses_verdict_correctly - task result has correct verdict field
10. test_scan_status_auth_required         - no token on status endpoint -> 401
"""

import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from flask_jwt_extended import create_access_token

from app import create_app
from app.models import db as _db
from app.models.user import User
from app.models.role import Role


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='module')
def app():
    """Create application for testing with Celery eager mode."""
    application = create_app('testing')
    # Enable synchronous task execution so tests don't need a broker
    application.config['CELERY_TASK_ALWAYS_EAGER'] = True
    application.config['CELERY_TASK_EAGER_PROPAGATES'] = True
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='module')
def client(app):
    """Test client."""
    return app.test_client()


@pytest.fixture(scope='module')
def regular_user(app):
    """Create a regular user."""
    with app.app_context():
        user = User(username='scan_test_user', email='scan_user@test.com')
        user.set_password('password123')
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='module')
def user_token(app, regular_user):
    """JWT token for regular user."""
    with app.app_context():
        return create_access_token(identity=str(regular_user))


@pytest.fixture()
def auth_headers(user_token):
    return {'Authorization': f'Bearer {user_token}'}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_VERDICT_RESPONSE = {
    'verdict': 'scam',
    'confidence': 0.92,
    'scam_score': 88.0,
    'reasoning': 'This email contains urgent language and suspicious links.',
}

SAMPLE_EMAIL_BODY = 'Click here to claim your prize: http://evil.example.com'
SAMPLE_SUBJECT = 'You have won!'


def _mock_analyze_result(verdict_dict: dict) -> MagicMock:
    """Create a mock DetectorAgentService.analyze_email return value."""
    mock_result = MagicMock()
    mock_result.final_output = json.dumps(verdict_dict)
    return mock_result



# ---------------------------------------------------------------------------
# 2 & 3 & 4. GET /api/scan/status/<job_id>
# ---------------------------------------------------------------------------

class TestScanStatus:
    """Tests for the GET /api/scan/status/<job_id> polling endpoint."""

    def test_scan_status_pending(self, client, auth_headers):
        """GET /api/scan/status/<id> with a PENDING celery task returns pending."""
        with patch('app.routes.scan.AsyncResult') as MockAsyncResult:
            mock_result = MagicMock()
            mock_result.state = 'PENDING'
            MockAsyncResult.return_value = mock_result

            response = client.get('/api/scan/status/some-job-id', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['status'] == 'pending'

    def test_scan_status_started(self, client, auth_headers):
        """GET /api/scan/status/<id> with a STARTED celery task returns pending."""
        with patch('app.routes.scan.AsyncResult') as MockAsyncResult:
            mock_result = MagicMock()
            mock_result.state = 'STARTED'
            MockAsyncResult.return_value = mock_result

            response = client.get('/api/scan/status/some-job-id', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['status'] == 'pending'

    def test_scan_status_complete(self, client, auth_headers):
        """GET /api/scan/status/<id> with SUCCESS state returns complete with verdict."""
        with patch('app.routes.scan.AsyncResult') as MockAsyncResult:
            mock_result = MagicMock()
            mock_result.state = 'SUCCESS'
            mock_result.result = {
                'status': 'complete',
                'verdict': 'phishing',
                'confidence': 0.92,
                'scam_score': 88.0,
                'reasoning': 'Suspicious links detected.',
            }
            MockAsyncResult.return_value = mock_result

            response = client.get('/api/scan/status/completed-job-id', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['status'] == 'complete'
        assert data['data']['verdict'] == 'phishing'
        assert data['data']['confidence'] == 0.92

    def test_scan_status_failed(self, client, auth_headers):
        """GET /api/scan/status/<id> with FAILURE state returns failed."""
        with patch('app.routes.scan.AsyncResult') as MockAsyncResult:
            mock_result = MagicMock()
            mock_result.state = 'FAILURE'
            mock_result.info = Exception('Detection service unavailable')
            MockAsyncResult.return_value = mock_result

            response = client.get('/api/scan/status/failed-job-id', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['status'] == 'failed'
        assert 'error' in data['data']

    def test_scan_status_auth_required(self, client):
        """GET /api/scan/status/<id> without auth token should return 401."""
        response = client.get('/api/scan/status/some-job-id')
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# 5. Celery task execution (CELERY_TASK_ALWAYS_EAGER)
# ---------------------------------------------------------------------------

class TestScanTaskExecution:
    """Tests for direct scan_email_task execution."""

    def test_scan_task_executes_with_valid_result(self, app):
        """scan_email_task.apply() runs synchronously and returns verdict dict."""
        from app.tasks.scan_tasks import scan_email_task

        mock_final_output = json.dumps(SAMPLE_VERDICT_RESPONSE)
        mock_result = MagicMock()
        mock_result.final_output = mock_final_output

        with app.app_context():
            with patch('app.tasks.scan_tasks._run_detector_sync') as mock_run:
                mock_run.return_value = SAMPLE_VERDICT_RESPONSE

                result = scan_email_task.apply(
                    args=[1, SAMPLE_SUBJECT, SAMPLE_EMAIL_BODY]
                )

        assert result.successful()
        task_result = result.result
        assert task_result['status'] == 'complete'
        assert task_result['verdict'] == 'phishing'  # 'scam' normalises to 'phishing'

    def test_scan_task_parses_verdict_correctly(self, app):
        """Task normalises raw verdict strings to canonical values."""
        from app.tasks.scan_tasks import scan_email_task

        verdicts_mapping = [
            ('scam', 'phishing'),
            ('likely scam', 'likely_phishing'),
            ('suspicious', 'suspicious'),
            ('likely legitimate', 'likely_legitimate'),
            ('legitimate', 'legitimate'),
        ]

        for raw_verdict, expected in verdicts_mapping:
            with app.app_context():
                with patch('app.tasks.scan_tasks._run_detector_sync') as mock_run:
                    mock_run.return_value = {
                        'verdict': raw_verdict,
                        'confidence': 0.8,
                        'scam_score': 50.0,
                        'reasoning': 'test',
                    }

                    result = scan_email_task.apply(
                        args=[1, 'Test subject', 'Test body']
                    )

            assert result.successful(), f"Task failed for verdict '{raw_verdict}'"
            assert result.result['verdict'] == expected, (
                f"Expected '{expected}' for raw '{raw_verdict}', got '{result.result['verdict']}'"
            )

    def test_scan_task_handles_detection_failure(self, app):
        """scan_email_task raises exception when detection service fails."""
        from app.tasks.scan_tasks import scan_email_task

        with app.app_context():
            with patch('app.tasks.scan_tasks._run_detector_sync') as mock_run:
                mock_run.side_effect = RuntimeError('Detection service down')

                result = scan_email_task.apply(
                    args=[1, 'subject', 'body']
                )

        assert result.failed()

    def test_scan_task_handles_invalid_json_output(self, app):
        """scan_email_task raises exception when detector returns invalid JSON."""
        from app.tasks.scan_tasks import scan_email_task

        with app.app_context():
            with patch('app.tasks.scan_tasks._run_detector_sync') as mock_run:
                mock_run.return_value = None  # Simulates failed parse -> ValueError

                result = scan_email_task.apply(
                    args=[1, 'subject', 'body']
                )

        assert result.failed()

    def test_scan_task_normalises_confidence_above_1(self, app):
        """Task normalises confidence values >1 (0-100 scale) to 0-1 range."""
        from app.tasks.scan_tasks import scan_email_task

        with app.app_context():
            with patch('app.tasks.scan_tasks._run_detector_sync') as mock_run:
                mock_run.return_value = {
                    'verdict': 'scam',
                    'confidence': 92.0,  # 0-100 scale
                    'scam_score': 88.0,
                    'reasoning': 'test',
                }

                result = scan_email_task.apply(
                    args=[1, 'subject', 'body']
                )

        assert result.successful()
        assert result.result['confidence'] == pytest.approx(0.92, abs=0.001)
