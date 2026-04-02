"""
Tests for scan-related API endpoints:
  - GET /api/scan/status/<job_id>  (Phase 0: 500-fix)
  - GET /api/scan/admin/recent     (Phase 1b: admin-only)
"""

import pytest
from datetime import datetime
from flask_jwt_extended import create_access_token

from app import create_app
from app.models import db as _db
from app.models.user import User
from app.models.role import Role
from app.models.user_scan import UserScan


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='session')
def app():
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='session')
def client(app):
    return app.test_client()


@pytest.fixture(scope='session')
def admin_user(app):
    with app.app_context():
        admin_role = Role.query.filter_by(name='admin').first()
        if not admin_role:
            admin_role = Role(name='admin')
            _db.session.add(admin_role)
            _db.session.commit()

        user = User(username='scan_admin', email='scan_admin@test.com')
        user.set_password('password123')
        user.roles.append(admin_role)
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='session')
def regular_user(app):
    with app.app_context():
        user = User(username='scan_user', email='scan_user@test.com')
        user.set_password('password123')
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='session')
def admin_token(app, admin_user):
    with app.app_context():
        return create_access_token(identity=str(admin_user))


@pytest.fixture(scope='session')
def user_token(app, regular_user):
    with app.app_context():
        return create_access_token(identity=str(regular_user))


@pytest.fixture(scope='session')
def scan_data(app, regular_user):
    """Seed two UserScan rows for testing."""
    with app.app_context():
        s1 = UserScan(
            user_id=regular_user,
            subject='Urgent: verify your account',
            body_snippet='Click here to verify.',
            full_body='Click here to verify your account immediately.',
            verdict='phishing',
            confidence=0.95,
            scam_score=0.9,
            reasoning='Classic phishing pattern.',
            scanned_at=datetime(2026, 3, 1, 10, 0, 0),
        )
        s2 = UserScan(
            user_id=regular_user,
            subject='Newsletter',
            body_snippet='This month in tech.',
            full_body='This month in tech — full article.',
            verdict='legitimate',
            confidence=0.85,
            scam_score=0.1,
            reasoning='Looks like a regular newsletter.',
            scanned_at=datetime(2026, 3, 2, 12, 0, 0),
        )
        _db.session.add_all([s1, s2])
        _db.session.commit()


# ---------------------------------------------------------------------------
# Tests: GET /api/scan/status/<job_id>  (Phase 0 — 500 fix)
# ---------------------------------------------------------------------------

class TestScanStatusEndpoint:
    """GET /api/scan/status/<job_id> must never return 5xx."""

    def test_unauthenticated_returns_401(self, client):
        response = client.get('/api/scan/status/nonexistent-job-id')
        assert response.status_code == 401

    def test_unknown_job_id_returns_200(self, client, user_token):
        """An unknown / invalid Celery job_id must return 200 with status=pending."""
        response = client.get(
            '/api/scan/status/totally-invalid-job-id-12345',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        # Celery returns PENDING state for unknown IDs; both 'pending' and 'failed'
        # are acceptable but must not be 5xx.
        assert data['data']['status'] in ('pending', 'failed')

    def test_response_never_500(self, client, user_token):
        """Even with a garbage UUID the endpoint should not 500."""
        for job_id in ['', '!!!invalid!!!', 'a' * 200]:
            response = client.get(
                f'/api/scan/status/{job_id}',
                headers={'Authorization': f'Bearer {user_token}'},
            )
            assert response.status_code != 500, (
                f"Got 500 for job_id={job_id!r}"
            )


# ---------------------------------------------------------------------------
# Tests: GET /api/scan/admin/recent  (Phase 1b)
# ---------------------------------------------------------------------------

class TestAdminRecentScansAuth:
    """Authentication and authorization for GET /api/scan/admin/recent."""

    def test_unauthenticated_returns_401(self, client):
        response = client.get('/api/scan/admin/recent')
        assert response.status_code == 401

    def test_regular_user_returns_403(self, client, user_token):
        response = client.get(
            '/api/scan/admin/recent',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        assert response.status_code == 403

    def test_admin_returns_200(self, client, admin_token, scan_data):
        response = client.get(
            '/api/scan/admin/recent',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        assert response.status_code == 200


class TestAdminRecentScansResponse:
    """Response shape and data for GET /api/scan/admin/recent."""

    @pytest.fixture(autouse=True)
    def fetch(self, client, admin_token, scan_data):
        resp = client.get(
            '/api/scan/admin/recent',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        self.body = resp.get_json()

    def test_success_flag(self):
        assert self.body['success'] is True

    def test_scans_key_is_list(self):
        assert isinstance(self.body['scans'], list)

    def test_pagination_keys_present(self):
        for key in ('total', 'page', 'per_page', 'pages'):
            assert key in self.body

    def test_scan_items_have_required_fields(self):
        required = {
            'id', 'user_id', 'user_email', 'subject', 'body_snippet',
            'full_body', 'verdict', 'confidence', 'scam_score',
            'reasoning', 'scanned_at',
        }
        for scan in self.body['scans']:
            assert required <= set(scan.keys()), (
                f"Scan item missing keys: {required - set(scan.keys())}"
            )

    def test_total_reflects_seeded_data(self):
        """At least 2 scans were seeded."""
        assert self.body['total'] >= 2

    def test_default_ordering_newest_first(self):
        """Scans should be ordered newest first (scanned_at DESC)."""
        scans = self.body['scans']
        if len(scans) >= 2:
            t0 = scans[0]['scanned_at']
            t1 = scans[1]['scanned_at']
            assert t0 >= t1

    def test_pagination_per_page(self, client, admin_token):
        """per_page query param should limit results."""
        resp = client.get(
            '/api/scan/admin/recent?page=1&per_page=1',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        body = resp.get_json()
        assert len(body['scans']) <= 1

    def test_invalid_pagination_returns_400(self, client, admin_token):
        resp = client.get(
            '/api/scan/admin/recent?page=abc',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        assert resp.status_code == 400
