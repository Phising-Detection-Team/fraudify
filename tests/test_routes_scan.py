"""Integration tests for /api/scan/* endpoints.

Rate-limit behaviour (@limiter.limit) is not tested here because the test
config sets RATELIMIT_ENABLED = False — Flask-Limiter's own test suite covers
that mechanism.  We test the business-logic guards we own:
  - authentication required
  - body required
  - body / subject size caps  ← NEW (test written before implementation)
  - happy-path scan result
  - detector failure → 503
  - scan history pagination
"""

import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_DETECTION = {
    'verdict': 'scam',
    'confidence': 0.95,
    'scam_score': 92.0,   # 0-100 scale, matching actual model output
    'reasoning': 'Contains suspicious links and urgency language.',
}

# 51 KB body — deliberately over the 50 KB cap we are adding
OVERSIZED_BODY = 'x' * (51 * 1024)
# 1 025 char subject — deliberately over the 1 024 char cap
OVERSIZED_SUBJECT = 's' * 1025


# ---------------------------------------------------------------------------
# POST /api/scan
# ---------------------------------------------------------------------------

class TestScanEmail:

    def test_scan_requires_auth(self, client, db):
        """Unauthenticated request must be rejected with 401."""
        resp = client.post('/api/scan', json={'body': 'Hello test email'})
        assert resp.status_code == 401

    def test_scan_missing_body_field(self, client, db, auth_headers_user):
        """Missing body field must return 400."""
        resp = client.post('/api/scan', json={'subject': 'No body here'}, headers=auth_headers_user)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data['success'] is False
        assert 'body' in data['error'].lower()

    def test_scan_empty_body_field(self, client, db, auth_headers_user):
        """Whitespace-only body must return 400."""
        resp = client.post('/api/scan', json={'body': '   '}, headers=auth_headers_user)
        assert resp.status_code == 400
        assert resp.get_json()['success'] is False

    def test_scan_body_too_large(self, client, db, auth_headers_user):
        """Body exceeding 50 KB must return 400 before hitting the AI service."""
        resp = client.post('/api/scan', json={'body': OVERSIZED_BODY}, headers=auth_headers_user)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data['success'] is False
        # Error message should hint at the size cap so the client knows what to fix
        assert '50' in data['error'] or 'large' in data['error'].lower()

    def test_scan_subject_too_large(self, client, db, auth_headers_user):
        """Subject exceeding 1 024 characters must return 400."""
        resp = client.post('/api/scan', json={
            'subject': OVERSIZED_SUBJECT,
            'body': 'Normal body text here.',
        }, headers=auth_headers_user)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data['success'] is False

    @patch('app.routes.scan._run_detector_sync')
    def test_scan_success_phishing(self, mock_detector, client, db, auth_headers_user):
        """Valid email is scanned; verdict is normalised and scan is persisted."""
        mock_detector.return_value = FAKE_DETECTION

        resp = client.post('/api/scan', json={
            'subject': 'You have won a prize',
            'body': 'Click here to claim your $1 000 reward immediately!',
        }, headers=auth_headers_user)

        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['verdict'] == 'phishing'   # 'scam' normalised → 'phishing'
        assert 0.0 <= data['data']['confidence'] <= 1.0
        assert isinstance(data['data']['reasoning'], str)

    @patch('app.routes.scan._run_detector_sync')
    def test_scan_success_without_subject(self, mock_detector, client, db, auth_headers_user):
        """Subject is optional; scan must succeed with body only."""
        mock_detector.return_value = {**FAKE_DETECTION, 'verdict': 'legitimate'}

        resp = client.post('/api/scan', json={'body': 'Plain email with no subject.'}, headers=auth_headers_user)

        assert resp.status_code == 200
        assert resp.get_json()['success'] is True

    @patch('app.routes.scan._run_detector_sync')
    def test_scan_detector_failure_returns_503(self, mock_detector, client, db, auth_headers_user):
        """Detection service failure must return 503, not 500."""
        mock_detector.side_effect = RuntimeError('AI service unavailable')

        resp = client.post('/api/scan', json={'body': 'Some email content here.'}, headers=auth_headers_user)

        assert resp.status_code == 503
        data = resp.get_json()
        assert data['success'] is False
        # Must not leak internal error details to the client
        assert 'RuntimeError' not in data.get('error', '')

    @patch('app.routes.scan._run_detector_sync')
    def test_scan_confidence_normalised_from_100_scale(self, mock_detector, client, db, auth_headers_user):
        """Confidence values in 0-100 range must be normalised to 0-1."""
        mock_detector.return_value = {**FAKE_DETECTION, 'confidence': 87}

        resp = client.post('/api/scan', json={'body': 'Test email.'}, headers=auth_headers_user)

        assert resp.status_code == 200
        assert resp.get_json()['data']['confidence'] == pytest.approx(0.87, abs=0.001)


# ---------------------------------------------------------------------------
# GET /api/scan/history
# ---------------------------------------------------------------------------

class TestScanHistory:

    def test_history_requires_auth(self, client, db):
        """Unauthenticated request must be rejected with 401."""
        resp = client.get('/api/scan/history')
        assert resp.status_code == 401

    def test_history_empty_for_new_user(self, client, db, auth_headers_user):
        """New user with no scans returns empty list."""
        resp = client.get('/api/scan/history', headers=auth_headers_user)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['scans'] == []
        assert data['total'] == 0

    @patch('app.routes.scan._run_detector_sync')
    def test_history_returns_user_scans(self, mock_detector, client, db, auth_headers_user):
        """History endpoint returns the user's own past scans."""
        mock_detector.return_value = FAKE_DETECTION

        client.post('/api/scan', json={'body': 'First email'}, headers=auth_headers_user)
        client.post('/api/scan', json={'body': 'Second email'}, headers=auth_headers_user)

        resp = client.get('/api/scan/history', headers=auth_headers_user)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['total'] == 2
        assert len(data['scans']) == 2

    def test_history_invalid_page_param(self, client, db, auth_headers_user):
        """Non-integer page param must return 400."""
        resp = client.get('/api/scan/history?page=abc', headers=auth_headers_user)
        assert resp.status_code == 400

    def test_history_default_pagination(self, client, db, auth_headers_user):
        """Response always includes pagination metadata."""
        resp = client.get('/api/scan/history', headers=auth_headers_user)
        data = resp.get_json()
        assert 'page' in data
        assert 'per_page' in data
        assert 'pages' in data
