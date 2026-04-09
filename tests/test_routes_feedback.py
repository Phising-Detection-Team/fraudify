"""Tests for the feedback blueprint: POST, GET, PATCH /api/feedback."""

import pytest
from app.models import Feedback

# ---------------------------------------------------------------------------
# POST /api/feedback
# ---------------------------------------------------------------------------

class TestSubmitFeedback:
    def test_submit_feedback_requires_jwt(self, client):
        resp = client.post('/api/feedback', json={
            "subject": "Great app",
            "description": "I really like the new design!"
        })
        assert resp.status_code == 401

    def test_submit_feedback_success(self, client, db, sample_user, auth_headers_user):
        payload = {
            "subject": "Bug found",
            "description": "Limiter is not working properly."
        }
        resp = client.post('/api/feedback', headers=auth_headers_user, json=payload)
        
        # Then
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["message"] == "Feedback submitted successfully."
        assert body["feedback"]["subject"] == "Bug found"
        assert body["feedback"]["description"] == "Limiter is not working properly."
        assert body["feedback"]["status"] == "pending"
        
        # Verify DB
        feedback = Feedback.query.filter_by(user_id=sample_user.id).first()
        assert feedback is not None
        assert feedback.subject == "Bug found"

    def test_submit_feedback_invalid_data(self, client, db, sample_user, auth_headers_user):
        # Missing description
        payload = {
            "subject": "Missing description"
        }
        resp = client.post('/api/feedback', headers=auth_headers_user, json=payload)
        assert resp.status_code == 400
        assert "errors" in resp.get_json()

# ---------------------------------------------------------------------------
# GET /api/feedback
# ---------------------------------------------------------------------------

class TestListFeedback:
    @pytest.fixture
    def setup_feedback(self, db, sample_user, sample_admin):
        f1 = Feedback(user_id=sample_user.id, subject="Sub 1", description="Desc 1", status="pending")
        f2 = Feedback(user_id=sample_user.id, subject="Sub 2", description="Desc 2", status="resolved")
        f3 = Feedback(user_id=sample_admin.id, subject="Sub 3", description="Desc 3", status="pending")
        db.session.add_all([f1, f2, f3])
        db.session.commit()
        return [f1, f2, f3]

    def test_list_feedback_requires_jwt(self, client):
        resp = client.get('/api/feedback')
        assert resp.status_code == 401

    def test_list_feedback_requires_admin(self, client, auth_headers_user):
        resp = client.get('/api/feedback', headers=auth_headers_user)
        assert resp.status_code == 403

    def test_list_feedback_admin_success(self, client, auth_headers_admin, setup_feedback):
        resp = client.get('/api/feedback', headers=auth_headers_admin)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 3
        assert len(body["items"]) == 3

    def test_list_feedback_filter_by_status(self, client, auth_headers_admin, setup_feedback):
        resp = client.get('/api/feedback?status=resolved', headers=auth_headers_admin)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 1
        assert body["items"][0]["status"] == "resolved"
        assert body["items"][0]["subject"] == "Sub 2"

# ---------------------------------------------------------------------------
# PATCH /api/feedback/<id>/status
# ---------------------------------------------------------------------------

class TestUpdateFeedbackStatus:
    @pytest.fixture
    def single_feedback(self, db, sample_user):
        f = Feedback(user_id=sample_user.id, subject="Update Me", description="Desc", status="pending")
        db.session.add(f)
        db.session.commit()
        return f

    def test_update_status_requires_jwt(self, client, single_feedback):
        resp = client.patch(f'/api/feedback/{single_feedback.id}/status', json={"status": "reviewed"})
        assert resp.status_code == 401

    def test_update_status_requires_admin(self, client, auth_headers_user, single_feedback):
        resp = client.patch(f'/api/feedback/{single_feedback.id}/status', headers=auth_headers_user, json={"status": "reviewed"})
        assert resp.status_code == 403

    def test_update_status_success(self, client, auth_headers_admin, single_feedback, db):
        resp = client.patch(f'/api/feedback/{single_feedback.id}/status', headers=auth_headers_admin, json={"status": "resolved"})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["message"] == "Feedback status updated."
        assert body["feedback"]["status"] == "resolved"

        # Verify DB
        f = db.session.get(Feedback, single_feedback.id)
        assert f.status == "resolved"

    def test_update_status_invalid_status(self, client, auth_headers_admin, single_feedback):
        resp = client.patch(f'/api/feedback/{single_feedback.id}/status', headers=auth_headers_admin, json={"status": "not_real"})
        assert resp.status_code == 400
        assert "errors" in resp.get_json()

    def test_update_status_not_found(self, client, auth_headers_admin):
        resp = client.patch('/api/feedback/9999/status', headers=auth_headers_admin, json={"status": "resolved"})
        assert resp.status_code == 404
