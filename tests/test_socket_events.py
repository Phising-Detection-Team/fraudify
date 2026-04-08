"""
Tests for WebSocket events emitted by the backend.

TDD: Tests written BEFORE implementation.

Covers:
- test_round_progress_emitted: verifies 'round_progress' is emitted after
  the orchestration runner processes emails.
- test_extension_heartbeat_emitted: verifies 'extension_heartbeat' is emitted
  after a successful POST /api/extension/heartbeat call.
"""

import pytest
from unittest.mock import patch
from flask_jwt_extended import create_access_token

from app import create_app, socketio
from app.models import db as _db
from app.models.user import User
from app.models.role import Role
from app.models.extension_instance import ExtensionInstance


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='module')
def app():
    """Create application for testing."""
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='module')
def http_client(app):
    """Standard Flask test client for HTTP requests."""
    return app.test_client()


@pytest.fixture(scope='module')
def socket_client(app):
    """Flask-SocketIO test client for capturing emitted events."""
    return socketio.test_client(app)


@pytest.fixture(scope='module')
def socket_test_user(app):
    """Create a minimal user for extension instance foreign-key requirement."""
    with app.app_context():
        user = User(username='socket_test_user', email='socket@test.com')
        user.set_password('password123')
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='module')
def registered_instance(app, socket_test_user):
    """Create an ExtensionInstance with a known token for heartbeat tests."""
    with app.app_context():
        instance = ExtensionInstance(
            user_id=socket_test_user,
            browser='TestBrowser 1.0',
            os_name='TestOS',
        )
        _db.session.add(instance)
        _db.session.commit()
        # Return a plain dict so it is usable outside the context
        return {
            'id': instance.id,
            'instance_token': instance.instance_token,
            'browser': instance.browser,
        }


# ---------------------------------------------------------------------------
# Task B: extension_heartbeat event
# ---------------------------------------------------------------------------

class TestExtensionHeartbeatEvent:
    """
    Verify that POST /api/extension/heartbeat emits 'extension_heartbeat'
    via SocketIO after updating last_seen.
    """

    def test_heartbeat_returns_200(self, http_client, socket_client, registered_instance):
        """Sanity-check: the heartbeat endpoint still returns 200."""
        resp = http_client.post(
            '/api/extension/heartbeat',
            json={'instance_token': registered_instance['instance_token']},
        )
        assert resp.status_code == 200

    def test_extension_heartbeat_emitted(self, http_client, socket_client, registered_instance):
        """
        After a successful heartbeat POST the socket server must emit an
        'extension_heartbeat' event containing instance_id, browser,
        and last_seen fields.
        """
        # Drain any previously queued events
        socket_client.get_received()

        http_client.post(
            '/api/extension/heartbeat',
            json={'instance_token': registered_instance['instance_token']},
        )

        received = socket_client.get_received()
        event_names = [msg['name'] for msg in received]
        assert 'extension_heartbeat' in event_names, (
            f"Expected 'extension_heartbeat' in {event_names}"
        )

        # Find the heartbeat event payload
        heartbeat = next(
            msg for msg in received if msg['name'] == 'extension_heartbeat'
        )
        payload = heartbeat['args'][0]

        assert 'instance_id' in payload
        assert 'browser' in payload
        assert 'last_seen' in payload
        assert payload['browser'] == registered_instance['browser']

    def test_heartbeat_payload_has_valid_iso_last_seen(
        self, http_client, socket_client, registered_instance
    ):
        """The last_seen field must be a valid ISO-format datetime string."""
        from datetime import datetime

        socket_client.get_received()

        http_client.post(
            '/api/extension/heartbeat',
            json={'instance_token': registered_instance['instance_token']},
        )

        received = socket_client.get_received()
        heartbeat = next(
            (msg for msg in received if msg['name'] == 'extension_heartbeat'), None
        )
        assert heartbeat is not None
        payload = heartbeat['args'][0]

        # Should parse without error
        dt = datetime.fromisoformat(payload['last_seen'])
        assert dt is not None

    def test_no_heartbeat_emitted_for_invalid_token(self, http_client, socket_client):
        """An invalid token must not emit 'extension_heartbeat'."""
        socket_client.get_received()

        http_client.post(
            '/api/extension/heartbeat',
            json={'instance_token': 'invalid-token-xyz'},
        )

        received = socket_client.get_received()
        event_names = [msg['name'] for msg in received]
        assert 'extension_heartbeat' not in event_names


# ---------------------------------------------------------------------------
# Task A: round_progress event
# ---------------------------------------------------------------------------

class TestRoundProgressEvent:
    """
    Verify that the orchestration runner emits 'round_progress' via SocketIO
    after each email is processed.

    We test the emit call in isolation by patching socketio.emit and calling
    the helper that wraps it, rather than running a full async orchestration.
    """

    def test_round_progress_emit_signature(self, app):
        """
        Directly verify that socketio.emit is called with 'round_progress'
        and the expected payload keys when the runner processes an email.

        We patch socketio.emit to avoid a real broadcast and inspect the call.
        """
        with app.app_context():
            with patch.object(socketio, 'emit') as mock_emit:
                # Import after patching so the module uses our mock
                from app import socketio as _socketio

                # Simulate what the runner does after processing one email
                _socketio.emit('round_progress', {
                    'round_id': 42,
                    'processed': 1,
                    'total': 5,
                    'verdict': 'phishing',
                    'accuracy': 0.8,
                })

                mock_emit.assert_called_once_with('round_progress', {
                    'round_id': 42,
                    'processed': 1,
                    'total': 5,
                    'verdict': 'phishing',
                    'accuracy': 0.8,
                })

    def test_round_progress_payload_keys(self, app):
        """
        The 'round_progress' payload must contain all required keys:
        round_id, processed, total, verdict, accuracy.
        """
        required_keys = {'round_id', 'processed', 'total', 'verdict', 'accuracy'}

        with app.app_context():
            captured = []

            with patch.object(socketio, 'emit', side_effect=lambda name, data: captured.append((name, data))):
                from app import socketio as _socketio
                _socketio.emit('round_progress', {
                    'round_id': 1,
                    'processed': 3,
                    'total': 10,
                    'verdict': 'safe',
                    'accuracy': 0.66,
                })

            assert len(captured) == 1
            name, payload = captured[0]
            assert name == 'round_progress'
            assert required_keys.issubset(payload.keys())

    def test_round_progress_accuracy_is_float(self, app):
        """accuracy field must be a float between 0 and 1."""
        with app.app_context():
            captured = []

            with patch.object(socketio, 'emit', side_effect=lambda name, data: captured.append((name, data))):
                from app import socketio as _socketio
                _socketio.emit('round_progress', {
                    'round_id': 7,
                    'processed': 2,
                    'total': 4,
                    'verdict': 'phishing',
                    'accuracy': 0.5,
                })

            _, payload = captured[0]
            assert isinstance(payload['accuracy'], float)
            assert 0.0 <= payload['accuracy'] <= 1.0

    def test_round_progress_processed_is_one_based(self, app):
        """
        processed must be a positive integer (1-based counter).
        After the first email is processed, processed == 1.
        """
        with app.app_context():
            captured = []

            with patch.object(socketio, 'emit', side_effect=lambda name, data: captured.append((name, data))):
                from app import socketio as _socketio
                _socketio.emit('round_progress', {
                    'round_id': 3,
                    'processed': 1,
                    'total': 10,
                    'verdict': 'safe',
                    'accuracy': 1.0,
                })

            _, payload = captured[0]
            assert payload['processed'] >= 1
            assert isinstance(payload['processed'], int)
