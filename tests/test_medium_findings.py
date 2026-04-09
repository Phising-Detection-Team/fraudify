"""
TDD tests for MEDIUM findings from pre-deployment review.

M-1  — Internal error details leaked in /api/scan/status error response
M-3  — send-verification allows unbounded re-sends (no rate check on existing unexpired codes)
M-5  — scan_history mutates dict returned by to_dict() (post-creation mutation)
"""

from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

import pytest

from app import create_app
from app.models import db as _db


@pytest.fixture(scope='module')
def app():
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='module')
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# M-1: Internal exc string must not leak in scan/status response
# ---------------------------------------------------------------------------

class TestScanStatusErrorLeak:
    def test_failure_state_does_not_expose_internal_error(self, client, app):
        """M-1: Celery FAILURE state must not return str(exc) to the client."""
        with app.app_context():
            from flask_jwt_extended import create_access_token
            from app.models.user import User
            from app.models.role import Role

            role = Role.query.filter_by(name='user').first()
            if not role:
                role = Role(name='user')
                _db.session.add(role)
                _db.session.commit()

            user = User(username='m1_user', email='m1@test.com')
            user.set_password('password123')
            _db.session.add(user)
            _db.session.commit()
            token = create_access_token(identity=str(user.id))

        mock_result = MagicMock()
        mock_result.state = 'FAILURE'
        mock_result.info = Exception('Connection to database timed out at host 10.0.0.5')

        with patch('app.routes.scan.AsyncResult', return_value=mock_result):
            resp = client.get(
                '/api/scan/status/fake-job-id',
                headers={'Authorization': f'Bearer {token}'},
            )

        data = resp.get_json()
        error_str = str(data)
        # Internal connection details must not appear in the response
        assert '10.0.0.5' not in error_str
        assert 'timed out' not in error_str

    def test_exception_in_status_handler_does_not_expose_details(self, client, app):
        """M-1: Exception path in /scan/status must not return str(exc)."""
        with app.app_context():
            from flask_jwt_extended import create_access_token
            from app.models.user import User
            u = User.query.filter_by(email='m1@test.com').first()
            token = create_access_token(identity=str(u.id))

        with patch('app.routes.scan.AsyncResult',
                   side_effect=Exception('secret-internal-detail')):
            resp = client.get(
                '/api/scan/status/fake-job-id',
                headers={'Authorization': f'Bearer {token}'},
            )

        data = resp.get_json()
        assert 'secret-internal-detail' not in str(data)


# ---------------------------------------------------------------------------
# M-3: send-verification must return 429 if unexpired code exists
# ---------------------------------------------------------------------------

class TestSendVerificationRateCheck:
    def test_returns_429_when_unexpired_verification_exists(self, client, app):
        """M-3: Re-sending a verification email when an unexpired code already
        exists must return 429 to prevent email bombing."""
        from app.models.user import User
        from app.models.email_verification import EmailVerification

        with app.app_context():
            # Create unverified user
            user = User(username='m3_user', email='m3@test.com')
            user.set_password('password123')
            _db.session.add(user)
            _db.session.commit()

            # Create a still-valid EmailVerification record
            ev = EmailVerification.generate(user.id)
            _db.session.add(ev)
            _db.session.commit()

        resp = client.post('/api/auth/send-verification',
                           json={'email': 'm3@test.com'})
        assert resp.status_code == 429

    def test_allows_resend_when_all_codes_are_expired(self, client, app):
        """M-3: Re-sending is allowed when all existing codes are expired."""
        from app.models.user import User
        from app.models.email_verification import EmailVerification

        with app.app_context():
            user = User(username='m3b_user', email='m3b@test.com')
            user.set_password('password123')
            _db.session.add(user)
            _db.session.commit()

            # Create an already-expired verification record
            ev = EmailVerification.generate(user.id)
            ev.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            _db.session.add(ev)
            _db.session.commit()

        with patch('app.routes.auth._send_verification'):
            resp = client.post('/api/auth/send-verification',
                               json={'email': 'm3b@test.com'})
        # Should be 200 (allowed) not 429
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# M-5: UserScan.to_dict() must optionally include full_body without mutation
# ---------------------------------------------------------------------------

class TestUserScanToDict:
    def test_to_dict_excludes_full_body_by_default(self, app):
        """M-5: Default to_dict() must not include full_body."""
        from app.models.user_scan import UserScan
        with app.app_context():
            scan = UserScan(
                user_id=None,
                subject='Test',
                body_snippet='snippet',
                full_body='The full email body text',
                verdict='legitimate',
                confidence=0.9,
            )
            result = scan.to_dict()
        assert 'full_body' not in result

    def test_to_dict_includes_full_body_when_requested(self, app):
        """M-5: to_dict(include_full_body=True) must return full_body."""
        from app.models.user_scan import UserScan
        with app.app_context():
            scan = UserScan(
                user_id=None,
                subject='Test',
                body_snippet='snippet',
                full_body='The full email body text',
                verdict='legitimate',
                confidence=0.9,
            )
            result = scan.to_dict(include_full_body=True)
        assert result['full_body'] == 'The full email body text'

    def test_to_dict_full_body_none_when_not_set(self, app):
        """M-5: to_dict(include_full_body=True) returns None when full_body is unset."""
        from app.models.user_scan import UserScan
        with app.app_context():
            scan = UserScan(
                user_id=None,
                subject='Test',
                body_snippet='snippet',
                full_body=None,
                verdict='legitimate',
                confidence=0.9,
            )
            result = scan.to_dict(include_full_body=True)
        assert result['full_body'] is None
