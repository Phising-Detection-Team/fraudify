import json
import pytest
from app import create_app, db as _db
from app.config import TestingConfig

@pytest.fixture(scope='module', autouse=True)
def patch_rate_limit_config():
    """Patch TestingConfig to ENABLE rate limits for this test module."""
    from app import limiter
    original = getattr(TestingConfig, 'RATELIMIT_ENABLED', False)
    original_enabled = limiter.enabled
    
    TestingConfig.RATELIMIT_ENABLED = True
    limiter.enabled = True
    yield
    TestingConfig.RATELIMIT_ENABLED = original
    limiter.enabled = original_enabled

@pytest.fixture
def rl_app():
    """Create a separate app instance specifically with rate limiting ENABLED"""
    app = create_app('testing')
    
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()

@pytest.fixture
def rl_client(rl_app):
    return rl_app.test_client()

def test_login_rate_limit(rl_client, rl_app):
    """
    Test that the login endpoint respects rate limiting (5 per minute).
    This ensures that brute-force attempts are properly blocked, 
    so the CI/CD pipeline catches if we ever break this configuration.
    """
    from app import limiter
    
    # Needs to be reset because limiter may cache between other previous tests
    with rl_app.app_context():
        limiter.reset()

    url = "/api/auth/login"
    payload = {"email": "test@sentra.app", "password": "password123"}

    # Fire 5 allowed requests
    for i in range(5):
        resp = rl_client.post(
            url, 
            data=json.dumps(payload),
            content_type="application/json"
        )
        assert resp.status_code != 429, f"Request {i+1} was incorrectly rate limited."

    # The 6th request MUST be rate limited (429 Too Many Requests)
    resp = rl_client.post(
        url, 
        data=json.dumps(payload),
        content_type="application/json"
    )
    assert resp.status_code == 429, f"6th Request was NOT rate limited! Status: {resp.status_code}"
    
    # Verify our custom JSON error handler works
    data = json.loads(resp.data)
    assert data.get("error", {}).get("code") == "TOO_MANY_REQUESTS"
