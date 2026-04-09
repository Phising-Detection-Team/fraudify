"""
Sprint 7 — R6 Scan Result Caching: Backend Tests.

TDD: Tests written BEFORE implementation.

Tests:
1. test_cache_miss_returns_202      — new email content → 202 + job_id
2. test_cache_hit_returns_200       — same content second time → 200 + cached:True + full verdict
3. test_cache_is_content_addressed  — different users, same content → cache hit on second user
4. test_cache_key_includes_subject  — different subject = different cache key (miss)
5. test_cache_helper_get_returns_none_on_miss  — get_scan_cache for unknown content returns None
6. test_cache_helper_set_and_get    — set then get returns same dict
7. test_cache_stats_endpoint        — GET /api/stats/cache returns 200 with cached_keys field
8. test_cache_stats_requires_admin  — user token → 403
"""

import json
import pytest
import fakeredis
from unittest.mock import MagicMock, patch

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
    """Create application for testing with Celery eager mode and in-memory Redis."""
    application = create_app('testing')
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
        user = User(username='cache_test_user', email='cache_user@test.com')
        user.set_password('password123')
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='module')
def second_user(app):
    """Create a second regular user to test cross-user cache."""
    with app.app_context():
        user = User(username='cache_test_user2', email='cache_user2@test.com')
        user.set_password('password123')
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='module')
def admin_user(app):
    """Create an admin user for stats endpoint tests."""
    with app.app_context():
        user = User(username='cache_admin_user', email='cache_admin@test.com')
        user.set_password('password123')
        admin_role = Role.query.filter_by(name='admin').first()
        if not admin_role:
            admin_role = Role(name='admin')
            _db.session.add(admin_role)
        user.roles.append(admin_role)
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='module')
def user_token(app, regular_user):
    """JWT token for regular user."""
    with app.app_context():
        return create_access_token(identity=str(regular_user))


@pytest.fixture(scope='module')
def second_user_token(app, second_user):
    """JWT token for second user."""
    with app.app_context():
        return create_access_token(identity=str(second_user))


@pytest.fixture(scope='module')
def admin_token(app, admin_user):
    """JWT token for admin user."""
    with app.app_context():
        return create_access_token(identity=str(admin_user))


@pytest.fixture()
def auth_headers(user_token):
    return {'Authorization': f'Bearer {user_token}'}


@pytest.fixture()
def second_auth_headers(second_user_token):
    return {'Authorization': f'Bearer {second_user_token}'}


@pytest.fixture()
def admin_headers(admin_token):
    return {'Authorization': f'Bearer {admin_token}'}


@pytest.fixture()
def fake_redis():
    """Create a fakeredis server and client for testing."""
    server = fakeredis.FakeServer()
    client = fakeredis.FakeRedis(server=server, decode_responses=True)
    return client


# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------

SAMPLE_VERDICT = {
    'status': 'complete',
    'verdict': 'phishing',
    'confidence': 0.92,
    'scam_score': 88.0,
    'reasoning': 'Suspicious links and urgent language detected.',
}

SAMPLE_SUBJECT = 'You have won a prize!'
SAMPLE_BODY = 'Click here to claim your $1000 prize: http://evil.example.com'

DIFFERENT_SUBJECT = 'Hello from your bank'
DIFFERENT_BODY = 'Please verify your account details at http://evil.example.com'


# ---------------------------------------------------------------------------
# 1. Cache miss → 202
# ---------------------------------------------------------------------------

class TestCacheMiss:
    """New email content triggers sync detection (200 response)."""

    def test_cache_miss_returns_200_and_calls_detector(self, client, auth_headers, fake_redis):
        """POST /api/scan with never-seen content returns 200 + calls detector."""
        with patch('app.cache.get_redis', return_value=fake_redis), \
             patch('app.routes.scan._run_detector_sync') as mock_detector:
            mock_detector.return_value = {
                'verdict': 'phishing',
                'confidence': 92.0,
                'scam_score': 88.0,
                'reasoning': 'Suspicious links...'
            }

            response = client.post(
                '/api/scan',
                json={'subject': SAMPLE_SUBJECT, 'body': SAMPLE_BODY},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['status'] == 'complete'
        mock_detector.assert_called_once()



# ---------------------------------------------------------------------------
# 2. Cache hit → 200 with cached:True
# ---------------------------------------------------------------------------

class TestCacheHit:
    """Already-seen email content returns cached verdict (200 response)."""

    def test_cache_hit_returns_200(self, client, auth_headers, fake_redis):
        """POST /api/scan with previously cached content returns 200 + cached:True."""
        # Pre-populate the cache
        from app.cache import make_scan_cache_key
        key = make_scan_cache_key(SAMPLE_SUBJECT, SAMPLE_BODY)
        fake_redis.setex(key, 3600, json.dumps(SAMPLE_VERDICT))

        with patch('app.cache.get_redis', return_value=fake_redis):
            response = client.post(
                '/api/scan',
                json={'subject': SAMPLE_SUBJECT, 'body': SAMPLE_BODY},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['cached'] is True
        assert data['data']['status'] == 'complete'
        assert data['data']['verdict'] == 'phishing'
        assert data['data']['confidence'] == 0.92

    def test_cache_hit_does_not_call_detector(self, client, auth_headers, fake_redis):
        """When cache hits, no detector sync task should be called."""
        from app.cache import make_scan_cache_key
        key = make_scan_cache_key(SAMPLE_SUBJECT, SAMPLE_BODY)
        fake_redis.setex(key, 3600, json.dumps(SAMPLE_VERDICT))

        with patch('app.cache.get_redis', return_value=fake_redis), \
             patch('app.routes.scan._run_detector_sync') as mock_detector:
            client.post(
                '/api/scan',
                json={'subject': SAMPLE_SUBJECT, 'body': SAMPLE_BODY},
                headers=auth_headers,
            )

        mock_detector.assert_not_called()


# ---------------------------------------------------------------------------
# 3. Cache is content-addressed: different users, same content → cache hit
# ---------------------------------------------------------------------------

class TestCacheContentAddressed:
    """Cache key is derived from content only, not user identity."""

    def test_cache_is_content_addressed(
        self, client, auth_headers, second_auth_headers, fake_redis
    ):
        """Same email content from two different users hits the same cache entry."""
        from app.cache import make_scan_cache_key
        key = make_scan_cache_key(SAMPLE_SUBJECT, SAMPLE_BODY)
        fake_redis.setex(key, 3600, json.dumps(SAMPLE_VERDICT))

        # First user gets cache hit
        with patch('app.cache.get_redis', return_value=fake_redis):
            resp1 = client.post(
                '/api/scan',
                json={'subject': SAMPLE_SUBJECT, 'body': SAMPLE_BODY},
                headers=auth_headers,
            )

        # Second user with the same content also gets cache hit
        with patch('app.cache.get_redis', return_value=fake_redis):
            resp2 = client.post(
                '/api/scan',
                json={'subject': SAMPLE_SUBJECT, 'body': SAMPLE_BODY},
                headers=second_auth_headers,
            )

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.get_json()['data']['cached'] is True
        assert resp2.get_json()['data']['cached'] is True


# ---------------------------------------------------------------------------
# 4. Different subject → different cache key (miss)
# ---------------------------------------------------------------------------

class TestCacheKeyVariants:
    """Cache key must include both subject and body."""

    def test_cache_key_includes_subject(self, client, auth_headers, fake_redis):
        """Different subject with same body produces a cache miss."""
        from app.cache import make_scan_cache_key

        # Pre-populate cache for SAMPLE_SUBJECT + SAMPLE_BODY
        original_key = make_scan_cache_key(SAMPLE_SUBJECT, SAMPLE_BODY)
        fake_redis.setex(original_key, 3600, json.dumps(SAMPLE_VERDICT))

        # Request with DIFFERENT_SUBJECT but same body should be a cache miss
        with patch('app.cache.get_redis', return_value=fake_redis), \
             patch('app.routes.scan._run_detector_sync') as mock_detector:
            mock_detector.return_value = {
                'verdict': 'phishing',
                'confidence': 92.0,
                'scam_score': 88.0,
                'reasoning': 'Suspicious links...'
            }

            response = client.post(
                '/api/scan',
                json={'subject': DIFFERENT_SUBJECT, 'body': SAMPLE_BODY},
                headers=auth_headers,
            )

        # Should be a miss → 200 and calls detector
        assert response.status_code == 200
        mock_detector.assert_called_once()

    def test_cache_key_includes_body(self, client, auth_headers, fake_redis):
        """Different body with same subject produces a cache miss."""
        from app.cache import make_scan_cache_key

        original_key = make_scan_cache_key(SAMPLE_SUBJECT, SAMPLE_BODY)
        fake_redis.setex(original_key, 3600, json.dumps(SAMPLE_VERDICT))

        with patch('app.cache.get_redis', return_value=fake_redis), \
             patch('app.routes.scan._run_detector_sync') as mock_detector:
            mock_detector.return_value = {
                'verdict': 'phishing',
                'confidence': 92.0,
                'scam_score': 88.0,
                'reasoning': 'Suspicious links...'
            }

            response = client.post(
                '/api/scan',
                json={'subject': SAMPLE_SUBJECT, 'body': DIFFERENT_BODY},
                headers=auth_headers,
            )

        assert response.status_code == 200
        mock_detector.assert_called_once()


# ---------------------------------------------------------------------------
# 5 & 6. Cache helper unit tests
# ---------------------------------------------------------------------------

class TestCacheHelpers:
    """Unit tests for get_scan_cache / set_scan_cache / make_scan_cache_key."""

    def test_cache_helper_get_returns_none_on_miss(self, app, fake_redis):
        """get_scan_cache returns None when key does not exist."""
        from app.cache import get_scan_cache
        with app.app_context():
            with patch('app.cache.get_redis', return_value=fake_redis):
                result = get_scan_cache('unknown subject', 'unknown body')
        assert result is None

    def test_cache_helper_set_and_get(self, app, fake_redis):
        """set_scan_cache followed by get_scan_cache returns the same dict."""
        from app.cache import get_scan_cache, set_scan_cache
        with app.app_context():
            with patch('app.cache.get_redis', return_value=fake_redis):
                set_scan_cache('test subject', 'test body', SAMPLE_VERDICT, ttl=60)
                result = get_scan_cache('test subject', 'test body')

        assert result is not None
        assert result['verdict'] == SAMPLE_VERDICT['verdict']
        assert result['confidence'] == SAMPLE_VERDICT['confidence']
        assert result['scam_score'] == SAMPLE_VERDICT['scam_score']
        assert result['reasoning'] == SAMPLE_VERDICT['reasoning']

    def test_cache_helper_returns_none_when_redis_unavailable(self, app):
        """get_scan_cache silently returns None when Redis is down."""
        from app.cache import get_scan_cache

        broken_redis = MagicMock()
        broken_redis.get.side_effect = Exception('Connection refused')

        with app.app_context():
            with patch('app.cache.get_redis', return_value=broken_redis):
                result = get_scan_cache('subject', 'body')

        assert result is None

    def test_set_cache_silently_ignores_redis_errors(self, app):
        """set_scan_cache does not raise when Redis is unavailable."""
        from app.cache import set_scan_cache

        broken_redis = MagicMock()
        broken_redis.setex.side_effect = Exception('Connection refused')

        with app.app_context():
            with patch('app.cache.get_redis', return_value=broken_redis):
                # Should not raise
                set_scan_cache('subject', 'body', SAMPLE_VERDICT, ttl=60)

    def test_make_scan_cache_key_is_deterministic(self, app):
        """Same content always produces the same cache key."""
        from app.cache import make_scan_cache_key
        with app.app_context():
            key1 = make_scan_cache_key('Subject', 'Body text')
            key2 = make_scan_cache_key('Subject', 'Body text')
        assert key1 == key2
        assert key1.startswith('scan:v1:')

    def test_make_scan_cache_key_differs_for_different_content(self, app):
        """Different content produces different cache keys."""
        from app.cache import make_scan_cache_key
        with app.app_context():
            key1 = make_scan_cache_key('Subject A', 'Body text')
            key2 = make_scan_cache_key('Subject B', 'Body text')
        assert key1 != key2

    def test_cache_ttl_is_applied(self, app, fake_redis):
        """set_scan_cache applies the TTL to the Redis key."""
        from app.cache import make_scan_cache_key, set_scan_cache
        with app.app_context():
            with patch('app.cache.get_redis', return_value=fake_redis):
                set_scan_cache('ttl subject', 'ttl body', SAMPLE_VERDICT, ttl=120)
                key = make_scan_cache_key('ttl subject', 'ttl body')
                ttl = fake_redis.ttl(key)
        # TTL should be close to 120 (fakeredis doesn't advance time)
        assert 0 < ttl <= 120


# ---------------------------------------------------------------------------
# 7. GET /api/stats/cache — requires admin
# ---------------------------------------------------------------------------

class TestCacheStatsEndpoint:
    """Tests for the /api/stats/cache stats endpoint."""

    def test_cache_stats_endpoint_returns_200(self, client, admin_headers, fake_redis):
        """GET /api/stats/cache with admin token returns 200 with cached_keys field."""
        with patch('app.cache.get_redis', return_value=fake_redis):
            response = client.get('/api/stats/cache', headers=admin_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'cached_keys' in data['data']
        assert 'available' in data['data']
        assert data['data']['available'] is True

    def test_cache_stats_shows_populated_key_count(self, client, admin_headers, fake_redis):
        """GET /api/stats/cache reflects keys actually stored in Redis."""
        from app.cache import make_scan_cache_key

        # Populate 2 distinct cache entries
        key1 = make_scan_cache_key('subject one', 'body one')
        key2 = make_scan_cache_key('subject two', 'body two')
        fake_redis.setex(key1, 3600, json.dumps(SAMPLE_VERDICT))
        fake_redis.setex(key2, 3600, json.dumps(SAMPLE_VERDICT))

        with patch('app.cache.get_redis', return_value=fake_redis):
            response = client.get('/api/stats/cache', headers=admin_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['cached_keys'] >= 2

    def test_cache_stats_requires_admin(self, client, auth_headers, fake_redis):
        """GET /api/stats/cache with regular user token returns 403."""
        with patch('app.cache.get_redis', return_value=fake_redis):
            response = client.get('/api/stats/cache', headers=auth_headers)

        assert response.status_code == 403

    def test_cache_stats_requires_auth(self, client):
        """GET /api/stats/cache without auth returns 401."""
        response = client.get('/api/stats/cache')
        assert response.status_code == 401

    def test_cache_stats_returns_unavailable_when_redis_down(
        self, client, admin_headers
    ):
        """GET /api/stats/cache with Redis down returns available:False instead of 500."""
        broken_redis = MagicMock()
        broken_redis.keys.side_effect = Exception('Connection refused')

        with patch('app.cache.get_redis', return_value=broken_redis):
            response = client.get('/api/stats/cache', headers=admin_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['available'] is False
        assert data['data']['cached_keys'] == 0


# ---------------------------------------------------------------------------
# 8. Celery task writes to cache after scan
# ---------------------------------------------------------------------------

class TestTaskWritesCache:
    """scan_email_task populates Redis cache after successful analysis."""

    def test_task_writes_to_cache_after_completion(self, app, fake_redis):
        """scan_email_task writes result to cache so subsequent requests get a hit."""
        from app.tasks.scan_tasks import scan_email_task
        from app.cache import get_scan_cache

        mock_detector_result = {
            'verdict': 'scam',
            'confidence': 0.90,
            'scam_score': 85.0,
            'reasoning': 'Phishing detected.',
        }

        # Also patch self.update_state to avoid needing a real Redis backend
        # for Celery task state updates during eager execution.
        with app.app_context():
            with patch('app.tasks.scan_tasks._run_detector_sync',
                       return_value=mock_detector_result), \
                 patch('app.cache.get_redis', return_value=fake_redis), \
                 patch.object(scan_email_task, 'update_state'):
                result = scan_email_task.apply(
                    args=[1, SAMPLE_SUBJECT, SAMPLE_BODY]
                )

        assert result.successful()

        # Now the cache should have an entry for this content
        with app.app_context():
            with patch('app.cache.get_redis', return_value=fake_redis):
                cached = get_scan_cache(SAMPLE_SUBJECT, SAMPLE_BODY)

        assert cached is not None
        assert cached['verdict'] == 'phishing'  # 'scam' normalised to 'phishing'
