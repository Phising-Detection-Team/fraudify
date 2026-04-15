import json
import base64
from unittest.mock import patch, MagicMock
from app.tasks.scan_tasks import _run_virustotal_sync
from app.cache import get_redis, set_vt_cache, get_vt_cache, track_and_check_vt_quota
from app.models import User

def test_virustotal_skips_without_api_key(client, app):
    with app.app_context():
        with patch('os.environ.get', return_value=None):
            urls = ["http://bad.com"]
            result = _run_virustotal_sync(urls, user_id=1, max_scans=10)
            assert result == []

def test_vt_quota_exceeded(client, app):
    with app.app_context():
        # If the user has exhausted their quota, it shouldn't call VT
        with patch('app.tasks.scan_tasks.track_and_check_vt_quota', return_value=False), \
             patch('os.environ.get', return_value='fake_key'), \
             patch('requests.get') as mock_requests:
             
            urls = ["http://bad.com"]
            result = _run_virustotal_sync(urls, user_id=1, max_scans=1)
            assert result == []
            mock_requests.assert_not_called()

def test_virustotal_uses_cache(client, app):
    with app.app_context():
        # If URL is in cache, it shouldn't call VT
        with patch('app.tasks.scan_tasks.get_vt_cache', return_value={"malicious": True}), \
             patch('os.environ.get', return_value='fake_key'), \
             patch('requests.get') as mock_requests:
             
            urls = ["http://cached-bad.com"]
            result = _run_virustotal_sync(urls, user_id=1, max_scans=10)
            assert result == ["http://cached-bad.com"]
            mock_requests.assert_not_called()

def test_virustotal_api_call_malicious(client, app):
    with app.app_context():
        # Mocking standard VirusTotal v3 URL API response for malicious URL
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "attributes": {
                    "last_analysis_stats": {
                        "malicious": 5,
                        "suspicious": 2,
                        "harmless": 80,
                    }
                }
            }
        }
        
        with patch('app.tasks.scan_tasks.get_vt_cache', return_value=None), \
             patch('app.tasks.scan_tasks.set_vt_cache') as mock_set_cache, \
             patch('app.tasks.scan_tasks.track_and_check_vt_quota', return_value=True), \
             patch('os.environ.get', return_value='fake_key'), \
             patch('requests.get', return_value=mock_resp) as mock_requests:
             
            urls = ["http://really-bad-phishing.com"]
            result = _run_virustotal_sync(urls, user_id=1, max_scans=10)
            
            assert result == ["http://really-bad-phishing.com"]
            mock_requests.assert_called_once()
            mock_set_cache.assert_called_once_with("http://really-bad-phishing.com", {"malicious": True})

def test_virustotal_api_call_benign(client, app):
    with app.app_context():
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "attributes": {
                    "last_analysis_stats": {
                        "malicious": 0,
                        "suspicious": 0,
                        "harmless": 85,
                    }
                }
            }
        }
        
        with patch('app.tasks.scan_tasks.get_vt_cache', return_value=None), \
             patch('app.tasks.scan_tasks.set_vt_cache') as mock_set_cache, \
             patch('app.tasks.scan_tasks.track_and_check_vt_quota', return_value=True), \
             patch('os.environ.get', return_value='fake_key'), \
             patch('requests.get', return_value=mock_resp):
             
            urls = ["https://google.com"]
            result = _run_virustotal_sync(urls, user_id=1, max_scans=10)
            
            assert result == []
            mock_set_cache.assert_called_once_with("https://google.com", {"malicious": False})

def test_dynamic_quota_calculation(client, db, sample_user, app):
    with app.app_context():
        # We have 1 user (sample_user) automatically from fixture
        total_users = max(1, User.query.filter_by(is_active=True).count())
        assert total_users >= 1  # May be more depending on fixture setup, but let's just use the current value
        
        vt_max_scans = max(1, 500 // total_users)
        assert vt_max_scans == 500 // total_users
        
        # Add a second active user
        new_user = User(email="second_virustotal_user@test.com", username="second_vt_tmp", is_active=True)
        new_user.set_password("Test1234!")
        db.session.add(new_user)
        db.session.commit()
        
        new_total = User.query.filter_by(is_active=True).count()
        assert new_total == total_users + 1
        vt_max_scans_new = max(1, 500 // new_total)
        assert vt_max_scans_new == 500 // (total_users + 1)
        
        # Track quota function test
        with patch('app.cache.get_redis') as mock_get_redis:
            mock_redis = MagicMock()
            mock_get_redis.return_value = mock_redis
            
            # User hasn't hit limit yet
            mock_redis.get.return_value = str(vt_max_scans_new - 1)
            assert track_and_check_vt_quota(sample_user.id, max_scans=vt_max_scans_new) is True
            
            # User hits limit
            mock_redis.get.return_value = str(vt_max_scans_new)
            assert track_and_check_vt_quota(sample_user.id, max_scans=vt_max_scans_new) is False

def test_api_scan_url_route_mocked(client, auth_headers_user):
    # End-to-end for the /api/scan/url route but mocking VT and Detector to avoid latency and real requests
    with patch('app.routes.scan._run_virustotal_sync', return_value=['http://bad.com']), \
         patch('app.routes.scan._run_detector_sync') as mock_detector:
         
        # LLM thinks it's harmless
        mock_detector.return_value = {
            "verdict": "legitimate",
            "confidence": 95,
            "scam_score": 10,
            "reasoning": "Looks okay"
        }
        
        response = client.post('/api/scan/url',
                               json={'url': 'http://bad.com'},
                               headers=auth_headers_user)
                               
        assert response.status_code == 200
        data = response.json['data']
        
        # But VT says it's bad, so it overrides!
        assert data['verdict'] == 'phishing'
        assert data['confidence'] == 1.0
        assert data['scam_score'] == 10.0
        assert 'VIRUSTOTAL' in data['reasoning']
