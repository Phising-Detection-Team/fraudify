"""Unit tests for /api/logs endpoints."""

import json
import pytest
from datetime import datetime, timezone, timedelta
from app.models import Log


class TestListLogs:
    """GET /api/logs - List system logs with filters."""

    def test_list_logs_empty(self, client, db):
        """List logs when none exist."""
        response = client.get('/api/logs')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['items'] == []

    def test_list_logs_success(self, client, sample_log):
        """List logs with data."""
        response = client.get('/api/logs')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['items']) >= 1
        assert data['items'][0]['id'] == sample_log.id
        assert data['items'][0]['level'] == 'info'

    def test_list_logs_paginated(self, client, db):
        """Test pagination."""
        # Create multiple logs
        for i in range(5):
            log = Log(
                level='info',
                message=f'Log message {i}',
                context={'index': i}
            )
            db.session.add(log)
        db.session.commit()

        response = client.get('/api/logs?page=1&per_page=3')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['items']) <= 3
        assert 'page' in data
        assert 'per_page' in data
        assert 'pages' in data

    def test_list_logs_filter_by_level(self, client, db):
        """Filter logs by level."""
        for level in ['info', 'warning', 'error']:
            log = Log(
                level=level,
                message=f'{level} message',
                context={}
            )
            db.session.add(log)
        db.session.commit()

        response = client.get('/api/logs?level=error')
        assert response.status_code == 200
        data = response.get_json()
        assert all(log['level'] == 'error' for log in data['items'])

    def test_list_logs_filter_level_invalid(self, client):
        """Reject invalid log level."""
        response = client.get('/api/logs?level=verbose')
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_list_logs_filter_by_round(self, client, db, sample_round):
        """Filter logs by round_id."""
        log1 = Log(
            round_id=sample_round.id,
            level='info',
            message='Round log'
        )
        log2 = Log(
            level='info',
            message='System log',
            round_id=None  # System-level log
        )
        db.session.add_all([log1, log2])
        db.session.commit()

        response = client.get(f'/api/logs?round_id={sample_round.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert all(log['round_id'] == sample_round.id for log in data['items'])

    def test_list_logs_filter_round_invalid_type(self, client):
        """Reject non-integer round_id."""
        response = client.get('/api/logs?round_id=abc')
        assert response.status_code == 400

    def test_list_logs_filter_by_time_range(self, client, db):
        """Filter logs by time range."""
        now = datetime.now(timezone.utc)
        past = now - timedelta(hours=1)

        log1 = Log(
            level='info',
            message='Old log',
            timestamp=past
        )
        log2 = Log(
            level='info',
            message='New log',
            timestamp=now
        )
        db.session.add_all([log1, log2])
        db.session.commit()

        # Filter using ISO format without timezone (endpoint uses fromisoformat)
        from_iso = past.replace(tzinfo=None).isoformat()
        to_iso = now.replace(tzinfo=None).isoformat()
        response = client.get(f'/api/logs?from={from_iso}&to={to_iso}')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['items']) >= 1

    def test_list_logs_filter_from_invalid_format(self, client):
        """Reject invalid ISO datetime."""
        response = client.get('/api/logs?from=not-a-date')
        assert response.status_code == 400

    def test_list_logs_filter_to_invalid_format(self, client):
        """Reject invalid ISO datetime in 'to' param."""
        response = client.get('/api/logs?to=not-a-date')
        assert response.status_code == 400

    def test_list_logs_search(self, client, db):
        """Search logs by message text."""
        log1 = Log(
            level='info',
            message='Critical database error occurred'
        )
        log2 = Log(
            level='info',
            message='API request processed successfully'
        )
        db.session.add_all([log1, log2])
        db.session.commit()

        response = client.get('/api/logs?search=database')
        assert response.status_code == 200
        data = response.get_json()
        assert all('database' in log['message'].lower() for log in data['items'])

    def test_list_logs_search_case_insensitive(self, client, db):
        """Search is case-insensitive."""
        log = Log(
            level='info',
            message='ERROR in system'
        )
        db.session.add(log)
        db.session.commit()

        response = client.get('/api/logs?search=error')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['items']) >= 1

    def test_list_logs_combined_filters(self, client, db, sample_round):
        """Combine level, round, and search filters."""
        log = Log(
            round_id=sample_round.id,
            level='error',
            message='Critical error in round processing'
        )
        db.session.add(log)
        db.session.commit()

        response = client.get(
            f'/api/logs?round_id={sample_round.id}&level=error&search=critical'
        )
        assert response.status_code == 200
        data = response.get_json()
        assert all(
            log['level'] == 'error' and log['round_id'] == sample_round.id
            for log in data['items']
        )

    def test_list_logs_response_format(self, client, sample_log):
        """Verify response has correct format."""
        response = client.get('/api/logs')
        assert response.status_code == 200
        data = response.get_json()
        assert 'success' in data
        assert 'items' in data
        assert 'total' in data
        assert 'page' in data
        assert 'per_page' in data

        log = data['items'][0]
        assert 'id' in log
        assert 'level' in log
        assert 'message' in log
        assert 'timestamp' in log
