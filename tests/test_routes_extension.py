"""Tests for the extension blueprint: POST /register, POST /heartbeat,
GET /instances, GET /instances/all."""

import pytest
from datetime import datetime, timezone, timedelta

from app.models import db as _db, User
from app.models.extension_instance import ExtensionInstance


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _login(client, email, password):
    """Return JWT access_token for the given credentials."""
    resp = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()['access_token']


def _bearer(token):
    return {'Authorization': f'Bearer {token}'}


def _create_instance(db, user_id, last_seen=None):
    """Directly insert an ExtensionInstance row and return it."""
    inst = ExtensionInstance(user_id=user_id, last_seen=last_seen)
    db.session.add(inst)
    db.session.commit()
    return inst


# ---------------------------------------------------------------------------
# POST /api/extension/register
# ---------------------------------------------------------------------------

class TestRegister:
    def test_register_requires_jwt(self, client, db, sample_user):
        resp = client.post('/api/extension/register', json={})
        assert resp.status_code == 401

    def test_register_creates_instance(self, client, db, sample_user, auth_headers_user):
        resp = client.post(
            '/api/extension/register',
            json={},
            headers=auth_headers_user,
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['success'] is True
        inst = data['data']
        assert 'instance_token' in inst
        assert 'id' in inst
        assert len(inst['instance_token']) == 32

    def test_register_stores_browser_and_os(self, client, db, sample_user, auth_headers_user):
        resp = client.post(
            '/api/extension/register',
            json={'browser': 'Chrome 124', 'os_name': 'Windows 11'},
            headers=auth_headers_user,
        )
        assert resp.status_code == 201
        inst = resp.get_json()['data']
        assert inst['browser'] == 'Chrome 124'
        assert inst['os_name'] == 'Windows 11'

    def test_register_same_browser_os_returns_existing(
        self, client, db, sample_user, auth_headers_user
    ):
        """Second registration with same browser+OS returns the existing instance (200)."""
        r1 = client.post(
            '/api/extension/register',
            json={'browser': 'Chrome 124', 'os_name': 'Windows 11'},
            headers=auth_headers_user,
        )
        r2 = client.post(
            '/api/extension/register',
            json={'browser': 'Chrome 124', 'os_name': 'Windows 11'},
            headers=auth_headers_user,
        )
        assert r1.status_code == 201
        assert r2.status_code == 200  # existing returned
        assert r1.get_json()['data']['instance_token'] == r2.get_json()['data']['instance_token']
        assert r1.get_json()['data']['id'] == r2.get_json()['data']['id']

    def test_register_different_browser_creates_new_instance(
        self, client, db, sample_user, auth_headers_user
    ):
        """Different browser/OS combinations create separate instances."""
        r1 = client.post(
            '/api/extension/register',
            json={'browser': 'Chrome 124', 'os_name': 'Windows 11'},
            headers=auth_headers_user,
        )
        r2 = client.post(
            '/api/extension/register',
            json={'browser': 'Edge 124', 'os_name': 'Windows 11'},
            headers=auth_headers_user,
        )
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.get_json()['data']['instance_token'] != r2.get_json()['data']['instance_token']

    def test_register_sets_last_seen(self, client, db, sample_user, auth_headers_user):
        resp = client.post('/api/extension/register', json={}, headers=auth_headers_user)
        assert resp.status_code == 201
        # last_seen is set to now on registration
        assert resp.get_json()['data']['last_seen'] is not None


# ---------------------------------------------------------------------------
# POST /api/extension/heartbeat
# ---------------------------------------------------------------------------

class TestHeartbeat:
    def test_heartbeat_jwt_required(self, client, db, sample_user, auth_headers_user):
        """Heartbeat requires an Authorization header."""
        inst = _create_instance(db, sample_user.id)
        # Should fail without JWT
        resp_no_auth = client.post(
            '/api/extension/heartbeat',
            json={'instance_token': inst.instance_token},
        )
        assert resp_no_auth.status_code == 401

        # Should succeed with JWT
        resp = client.post(
            '/api/extension/heartbeat',
            headers=auth_headers_user,
            json={'instance_token': inst.instance_token},
        )
        assert resp.status_code == 200
        assert resp.get_json()['success'] is True

    def test_heartbeat_updates_last_seen(self, client, db, sample_user, auth_headers_user):
        # Use naive UTC so comparison works against SQLite-stored naive datetimes
        old_time = datetime.utcnow() - timedelta(hours=1)
        inst = _create_instance(db, sample_user.id, last_seen=old_time)

        resp = client.post(
            '/api/extension/heartbeat',
            headers=auth_headers_user,
            json={'instance_token': inst.instance_token},
        )
        assert resp.status_code == 200

        # Refresh from DB; SQLite returns naive datetimes so strip tz for comparison
        _db.session.refresh(inst)
        stored = inst.last_seen
        if stored is not None and stored.tzinfo is not None:
            stored = stored.replace(tzinfo=None)
        assert stored > old_time

    def test_heartbeat_marks_instance_active(self, client, db, sample_user, auth_headers_user):
        inst = _create_instance(db, sample_user.id)
        resp = client.post(
            '/api/extension/heartbeat',
            headers=auth_headers_user,
            json={'instance_token': inst.instance_token},
        )
        assert resp.get_json()['is_active'] is True

    def test_heartbeat_unknown_token(self, client, db, auth_headers_user):
        resp = client.post(
            '/api/extension/heartbeat',
            headers=auth_headers_user,
            json={'instance_token': 'nonexistenttoken00000000000000'},
        )
        assert resp.status_code == 404

    def test_heartbeat_missing_token(self, client, db, auth_headers_user):
        resp = client.post('/api/extension/heartbeat', headers=auth_headers_user, json={})
        assert resp.status_code == 400

    def test_heartbeat_empty_token(self, client, db, auth_headers_user):
        resp = client.post('/api/extension/heartbeat', headers=auth_headers_user, json={'instance_token': ''})
        assert resp.status_code == 400

    def test_heartbeat_rate_limited_after_threshold(self, client, app, db, sample_user, auth_headers_user):
        """POST /api/extension/heartbeat returns 429 once the per-minute limit is exceeded.

        Flask-Limiter is disabled globally in the test config (RATELIMIT_ENABLED=False),
        so we temporarily enable it for this single test and restore the setting afterwards.
        The rate limit is expected to be '5 per minute' on this endpoint.
        """
        from app import limiter

        inst = _create_instance(db, sample_user.id)
        token = inst.instance_token

        # Manually bootstrap the limiter internals without calling init_app
        # (init_app can't be called after the app has handled its first request,
        # and it skips storage init when RATELIMIT_ENABLED=False anyway).
        from flask_limiter._extension import STRATEGIES
        from limits.storage import storage_from_string

        test_storage = storage_from_string('memory://')
        test_limiter_backend = STRATEGIES['fixed-window'](test_storage)

        import flask
        old_enabled = limiter.enabled
        old_initialized = limiter.initialized
        old_storage = limiter._storage
        old_backend = limiter._limiter
        old_strategy = limiter._strategy
        old_request_identifier = limiter._request_identifier

        limiter.enabled = True
        limiter.initialized = True
        limiter._storage = test_storage
        limiter._limiter = test_limiter_backend
        limiter._strategy = 'fixed-window'
        limiter._request_identifier = lambda: flask.request.endpoint or ''

        try:
            for _ in range(5):
                resp = client.post(
                    '/api/extension/heartbeat',
                    headers=auth_headers_user,
                    json={'instance_token': token},
                )
                assert resp.status_code == 200, f'Expected 200 but got {resp.status_code}'

            # The 6th request in the same minute must be rejected
            resp = client.post(
                '/api/extension/heartbeat',
                headers=auth_headers_user,
                json={'instance_token': token},
            )
            assert resp.status_code == 429
        finally:
            # Restore original state so subsequent tests are unaffected
            limiter.enabled = old_enabled
            limiter.initialized = old_initialized
            limiter._storage = old_storage
            limiter._limiter = old_backend
            limiter._strategy = old_strategy
            limiter._request_identifier = old_request_identifier


# ---------------------------------------------------------------------------
# GET /api/extension/instances  (own instances)
# ---------------------------------------------------------------------------

class TestListInstances:
    def test_list_instances_requires_jwt(self, client, db):
        resp = client.get('/api/extension/instances')
        assert resp.status_code == 401

    def test_list_instances_empty(self, client, db, sample_user, auth_headers_user):
        resp = client.get('/api/extension/instances', headers=auth_headers_user)
        assert resp.status_code == 200
        assert resp.get_json()['data'] == []

    def test_list_instances_returns_own_only(
        self, client, db, sample_user, sample_admin, auth_headers_user, auth_headers_admin
    ):
        # Create one instance for user, one for admin
        _create_instance(db, sample_user.id)
        _create_instance(db, sample_admin.id)

        resp = client.get('/api/extension/instances', headers=auth_headers_user)
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert len(data) == 1
        assert data[0]['user_id'] == sample_user.id

    def test_list_instances_includes_expected_fields(
        self, client, db, sample_user, auth_headers_user
    ):
        _create_instance(db, sample_user.id, last_seen=datetime.now(timezone.utc))
        resp = client.get('/api/extension/instances', headers=auth_headers_user)
        inst = resp.get_json()['data'][0]
        for key in ('id', 'user_id', 'instance_token', 'is_active', 'last_seen', 'created_at'):
            assert key in inst

    def test_list_instances_multiple(self, client, db, sample_user, auth_headers_user):
        _create_instance(db, sample_user.id, last_seen=datetime.now(timezone.utc))
        _create_instance(db, sample_user.id, last_seen=datetime.now(timezone.utc))
        resp = client.get('/api/extension/instances', headers=auth_headers_user)
        assert len(resp.get_json()['data']) == 2

    def test_list_auto_purges_stale_instances(
        self, client, db, sample_user, auth_headers_user
    ):
        """Instances with last_seen older than 30 days are deleted on list."""
        old_time = datetime.now(timezone.utc) - timedelta(days=31)
        stale = _create_instance(db, sample_user.id, last_seen=old_time)
        stale_id = stale.id
        fresh = _create_instance(db, sample_user.id, last_seen=datetime.now(timezone.utc))

        resp = client.get('/api/extension/instances', headers=auth_headers_user)
        returned_ids = [i['id'] for i in resp.get_json()['data']]

        assert fresh.id in returned_ids
        assert stale_id not in returned_ids
        assert db.session.get(ExtensionInstance, stale_id) is None

    def test_list_purges_never_seen_old_instances(
        self, client, db, sample_user, auth_headers_user
    ):
        """Instances with NULL last_seen and created_at > 30 days ago are deleted."""
        old_inst = ExtensionInstance(user_id=sample_user.id)
        db.session.add(old_inst)
        db.session.commit()
        # Back-date created_at
        old_inst.created_at = datetime.now(timezone.utc) - timedelta(days=31)
        db.session.commit()
        old_id = old_inst.id

        client.get('/api/extension/instances', headers=auth_headers_user)
        assert db.session.get(ExtensionInstance, old_id) is None


# ---------------------------------------------------------------------------
# DELETE /api/extension/instances/<id>
# ---------------------------------------------------------------------------

class TestDeleteInstance:
    def test_delete_requires_jwt(self, client, db, sample_user):
        inst = _create_instance(db, sample_user.id)
        resp = client.delete(f'/api/extension/instances/{inst.id}')
        assert resp.status_code == 401

    def test_delete_own_instance(self, client, db, sample_user, auth_headers_user):
        inst = _create_instance(db, sample_user.id)
        inst_id = inst.id
        resp = client.delete(
            f'/api/extension/instances/{inst_id}',
            headers=auth_headers_user,
        )
        assert resp.status_code == 200
        assert resp.get_json()['success'] is True
        assert db.session.get(ExtensionInstance, inst_id) is None

    def test_delete_other_users_instance_returns_404(
        self, client, db, sample_user, sample_admin, auth_headers_admin
    ):
        inst = _create_instance(db, sample_user.id)
        resp = client.delete(
            f'/api/extension/instances/{inst.id}',
            headers=auth_headers_admin,
        )
        assert resp.status_code == 404

    def test_delete_nonexistent_instance_returns_404(
        self, client, db, auth_headers_user
    ):
        resp = client.delete('/api/extension/instances/99999', headers=auth_headers_user)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/extension/instances/all  (admin only)
# ---------------------------------------------------------------------------

class TestListAllInstances:
    def test_list_all_requires_jwt(self, client, db):
        resp = client.get('/api/extension/instances/all')
        assert resp.status_code == 401

    def test_list_all_requires_admin(self, client, db, sample_user, auth_headers_user):
        resp = client.get('/api/extension/instances/all', headers=auth_headers_user)
        assert resp.status_code == 403

    def test_list_all_returns_all_instances(
        self, client, db, sample_user, sample_admin, auth_headers_admin
    ):
        _create_instance(db, sample_user.id)
        _create_instance(db, sample_admin.id)

        resp = client.get('/api/extension/instances/all', headers=auth_headers_admin)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['total'] == 2
        assert len(body['data']) == 2

    def test_list_all_includes_user_field(
        self, client, db, sample_user, auth_headers_admin
    ):
        _create_instance(db, sample_user.id)
        resp = client.get('/api/extension/instances/all', headers=auth_headers_admin)
        item = resp.get_json()['data'][0]
        assert 'user' in item
        assert item['user']['email'] == sample_user.email

    def test_list_all_active_count(
        self, client, db, sample_user, sample_admin, auth_headers_admin
    ):
        recent = datetime.now(timezone.utc) - timedelta(minutes=1)
        stale = datetime.now(timezone.utc) - timedelta(minutes=10)
        _create_instance(db, sample_user.id, last_seen=recent)
        _create_instance(db, sample_admin.id, last_seen=stale)

        resp = client.get('/api/extension/instances/all', headers=auth_headers_admin)
        body = resp.get_json()
        assert body['active'] == 1
        assert body['total'] == 2

    def test_list_all_empty(self, client, db, auth_headers_admin):
        resp = client.get('/api/extension/instances/all', headers=auth_headers_admin)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['data'] == []
        assert body['total'] == 0
        assert body['active'] == 0
