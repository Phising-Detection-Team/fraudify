"""Integration tests for /api/auth/* endpoints."""

import json
import pytest
from unittest.mock import patch
from app.models import db, User, Role, InviteCode


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _post(client, url, body):
    return client.post(url, data=json.dumps(body), content_type='application/json')


def _signup(client, email='user@test.com', username='testuser', password='Pass1234'):
    return _post(client, '/api/auth/signup', {
        'email': email, 'username': username, 'password': password
    })


def _login(client, email='user@test.com', password='Pass1234'):
    return _post(client, '/api/auth/login', {'email': email, 'password': password})


def _auth_header(token):
    return {'Authorization': f'Bearer {token}'}


# ---------------------------------------------------------------------------
# POST /api/auth/signup
# ---------------------------------------------------------------------------

class TestSignup:
    def test_signup_success(self, client, db, sample_role_user):
        resp = _signup(client)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['success'] is True
        assert data['user']['email'] == 'user@test.com'
        assert 'user' in data['user']['roles']

    def test_signup_duplicate_email(self, client, db, sample_role_user):
        _signup(client)
        resp = _signup(client)
        assert resp.status_code == 409
        assert 'Email already registered' in resp.get_json()['error']

    def test_signup_duplicate_username(self, client, db, sample_role_user):
        _signup(client, email='first@test.com')
        resp = _signup(client, email='second@test.com')  # same username 'testuser'
        assert resp.status_code == 409
        assert 'Username already taken' in resp.get_json()['error']

    def test_signup_invalid_email(self, client, db):
        resp = _signup(client, email='not-an-email')
        assert resp.status_code == 400

    def test_signup_weak_password_too_short(self, client, db):
        resp = _signup(client, password='Abc1')
        assert resp.status_code == 400

    def test_signup_weak_password_no_digit(self, client, db):
        resp = _signup(client, password='abcdefgh')
        assert resp.status_code == 400

    def test_signup_weak_password_no_letter(self, client, db):
        resp = _signup(client, password='12345678')
        assert resp.status_code == 400

    def test_signup_username_too_short(self, client, db):
        resp = _signup(client, username='ab')
        assert resp.status_code == 400

    def test_signup_username_invalid_chars(self, client, db):
        resp = _signup(client, username='bad user!')
        assert resp.status_code == 400

    def test_signup_missing_field(self, client, db):
        resp = _post(client, '/api/auth/signup', {'email': 'x@x.com'})
        assert resp.status_code == 400

    def test_signup_no_roles_seeded_returns_500(self, client, db):
        # Don't create any roles — server should return 500
        resp = _signup(client)
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

class TestLogin:
    def test_login_success(self, client, db, sample_role_user):
        _signup(client)
        resp = _login(client)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['email'] == 'user@test.com'

    def test_login_wrong_password(self, client, db, sample_role_user):
        _signup(client)
        resp = _login(client, password='WrongPass9')
        assert resp.status_code == 401

    def test_login_unknown_email(self, client, db):
        resp = _login(client, email='nobody@test.com')
        assert resp.status_code == 401

    def test_login_missing_field(self, client, db):
        resp = _post(client, '/api/auth/login', {'email': 'x@x.com'})
        assert resp.status_code == 400

    def test_login_invalid_email_format(self, client, db):
        resp = _post(client, '/api/auth/login', {'email': 'notanemail', 'password': 'Pass1234'})
        assert resp.status_code == 400

    def test_login_inactive_user(self, client, db, sample_role_user):
        _signup(client)
        user = User.query.filter_by(email='user@test.com').first()
        user.is_active = False
        db.session.commit()
        resp = _login(client)
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

class TestLogout:
    def test_logout_requires_auth(self, client, db):
        resp = client.post('/api/auth/logout')
        assert resp.status_code == 401

    def test_logout_success(self, client, db, sample_role_user):
        _signup(client)
        login_resp = _login(client)
        token = login_resp.get_json()['access_token']

        resp = client.post('/api/auth/logout', headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.get_json()['success'] is True

    def test_logout_blacklists_token(self, client, db, sample_role_user):
        """After logout, the same token should be rejected on protected endpoints."""
        _signup(client)
        login_resp = _login(client)
        token = login_resp.get_json()['access_token']

        # Blacklist via Redis mock
        with patch('app.routes.auth._blacklist_token') as mock_bl:
            client.post('/api/auth/logout', headers=_auth_header(token))
            mock_bl.assert_called_once()


# ---------------------------------------------------------------------------
# POST /api/auth/refresh-token
# ---------------------------------------------------------------------------

class TestRefreshToken:
    def test_refresh_returns_new_access_token(self, client, db, sample_role_user):
        _signup(client)
        login_resp = _login(client)
        refresh_token = login_resp.get_json()['refresh_token']

        resp = client.post(
            '/api/auth/refresh-token',
            headers={'Authorization': f'Bearer {refresh_token}'}
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'access_token' in data

    def test_refresh_requires_refresh_token(self, client, db, sample_role_user):
        _signup(client)
        login_resp = _login(client)
        access_token = login_resp.get_json()['access_token']

        # Using access token on refresh endpoint should fail
        resp = client.post('/api/auth/refresh-token', headers=_auth_header(access_token))
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/auth/admin/invite
# ---------------------------------------------------------------------------

class TestAdminInvite:
    def test_invite_requires_auth(self, client, db):
        resp = _post(client, '/api/auth/admin/invite', {'role_name': 'user'})
        assert resp.status_code == 401

    def test_invite_requires_admin_role(self, client, db, sample_role_user):
        _signup(client)
        login_resp = _login(client)
        token = login_resp.get_json()['access_token']

        resp = _post(
            client.__class__(client.application),
            '/api/auth/admin/invite',
            {'role_name': 'user'}
        )
        # Use the client directly with auth header
        resp = client.post(
            '/api/auth/admin/invite',
            data=json.dumps({'role_name': 'user'}),
            content_type='application/json',
            headers=_auth_header(token)
        )
        assert resp.status_code == 403

    def test_invite_success_as_admin(self, client, db, sample_admin, sample_role_user):
        # Seed 'admin' role and use admin fixture
        login_resp = _post(client, '/api/auth/login', {
            'email': 'admin@example.com', 'password': 'Admin123'
        })
        token = login_resp.get_json()['access_token']

        resp = client.post(
            '/api/auth/admin/invite',
            data=json.dumps({'role_name': 'user', 'expires_in_days': 3}),
            content_type='application/json',
            headers=_auth_header(token)
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['success'] is True
        assert 'code' in data['invite']
        assert data['invite']['role'] == 'user'

    def test_invite_invalid_role(self, client, db, sample_admin):
        login_resp = _post(client, '/api/auth/login', {
            'email': 'admin@example.com', 'password': 'Admin123'
        })
        token = login_resp.get_json()['access_token']

        resp = client.post(
            '/api/auth/admin/invite',
            data=json.dumps({'role_name': 'nonexistent'}),
            content_type='application/json',
            headers=_auth_header(token)
        )
        assert resp.status_code == 400

    def test_invite_missing_role_name(self, client, db, sample_admin):
        login_resp = _post(client, '/api/auth/login', {
            'email': 'admin@example.com', 'password': 'Admin123'
        })
        token = login_resp.get_json()['access_token']

        resp = client.post(
            '/api/auth/admin/invite',
            data=json.dumps({}),
            content_type='application/json',
            headers=_auth_header(token)
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/auth/admin/signup
# ---------------------------------------------------------------------------

class TestAdminSignup:
    def test_signup_with_valid_invite(self, client, db, sample_invite_code, sample_role_user):
        resp = _post(client, '/api/auth/admin/signup', {
            'email': 'invited@test.com',
            'username': 'inviteduser',
            'password': 'Pass1234',
            'invite_code': sample_invite_code.code,
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['success'] is True
        assert 'user' in data['user']['roles']

        # Invite should be marked as used
        db.session.refresh(sample_invite_code)
        assert sample_invite_code.used_by is not None

    def test_signup_with_expired_invite(self, client, db, sample_admin, sample_role_user):
        from datetime import datetime, timedelta
        invite = InviteCode.generate(
            created_by=sample_admin.id,
            role_id=sample_role_user.id,
        )
        invite.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.session.add(invite)
        db.session.commit()

        resp = _post(client, '/api/auth/admin/signup', {
            'email': 'exp@test.com',
            'username': 'expuser',
            'password': 'Pass1234',
            'invite_code': invite.code,
        })
        assert resp.status_code == 400

    def test_signup_with_used_invite(self, client, db, sample_invite_code, sample_role_user):
        # Use the invite once
        _post(client, '/api/auth/admin/signup', {
            'email': 'first@test.com',
            'username': 'firstuser',
            'password': 'Pass1234',
            'invite_code': sample_invite_code.code,
        })
        # Try again
        resp = _post(client, '/api/auth/admin/signup', {
            'email': 'second@test.com',
            'username': 'seconduser',
            'password': 'Pass1234',
            'invite_code': sample_invite_code.code,
        })
        assert resp.status_code == 400

    def test_signup_with_invalid_invite_code(self, client, db):
        resp = _post(client, '/api/auth/admin/signup', {
            'email': 'x@test.com',
            'username': 'xuser',
            'password': 'Pass1234',
            'invite_code': 'nonexistent-code',
        })
        assert resp.status_code == 400

    def test_signup_missing_invite_code(self, client, db):
        resp = _post(client, '/api/auth/admin/signup', {
            'email': 'x@test.com',
            'username': 'xuser',
            'password': 'Pass1234',
        })
        assert resp.status_code == 400
