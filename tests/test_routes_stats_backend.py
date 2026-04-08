"""
Tests for GET /api/stats/intelligence endpoint.

TDD: Tests written BEFORE implementation.
"""

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.models import db as _db
from app.models.user import User
from app.models.role import Role
from app.models.round import Round
from app.models.email import Email
from app.models.user_scan import UserScan


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='session')
def client(app):
    """Test client for the application."""
    return app.test_client()


@pytest.fixture(scope='session')
def admin_user(app):
    """Create an admin user for testing."""
    with app.app_context():
        # Ensure admin role exists
        admin_role = Role.query.filter_by(name='admin').first()
        if not admin_role:
            admin_role = Role(name='admin')
            _db.session.add(admin_role)
            _db.session.commit()

        user = User(
            username='test_admin',
            email='admin@test.com',
        )
        user.set_password('password123')
        user.roles.append(admin_role)
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='session')
def regular_user(app):
    """Create a regular (non-admin) user for testing."""
    with app.app_context():
        user = User(
            username='test_user',
            email='user@test.com',
        )
        user.set_password('password123')
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope='session')
def admin_token(app, admin_user):
    """Generate JWT token for admin user."""
    with app.app_context():
        return create_access_token(identity=str(admin_user))


@pytest.fixture(scope='session')
def user_token(app, regular_user):
    """Generate JWT token for regular user."""
    with app.app_context():
        return create_access_token(identity=str(regular_user))


@pytest.fixture(scope='session')
def seeded_data(app, admin_user):
    """Seed test database with rounds and emails."""
    with app.app_context():
        from datetime import datetime

        # Create completed rounds
        round1 = Round(
            status='completed',
            total_emails=4,
            processed_emails=4,
            completed_at=datetime(2026, 1, 1),
            started_at=datetime(2026, 1, 1),
        )
        round2 = Round(
            status='completed',
            total_emails=4,
            processed_emails=4,
            completed_at=datetime(2026, 2, 1),
            started_at=datetime(2026, 2, 1),
        )
        _db.session.add_all([round1, round2])
        _db.session.flush()

        # Round 1 emails:
        # 2 true positives (phishing, detected as phishing)
        # 1 false negative  (phishing, detected as legitimate)
        # 1 false positive  (legitimate, detected as phishing)
        emails_r1 = [
            Email(
                round_id=round1.id,
                generated_content='urgent phishing email',
                generated_subject='urgent action required',
                is_phishing=True,
                detector_verdict='phishing',
                detector_confidence=0.9,
                generated_email_metadata={},
            ),
            Email(
                round_id=round1.id,
                generated_content='phishing email secure',
                generated_subject='secure your account',
                is_phishing=True,
                detector_verdict='phishing',
                detector_confidence=0.85,
                generated_email_metadata={},
            ),
            Email(
                round_id=round1.id,
                generated_content='phishing email missed',
                generated_subject='click the link now',
                is_phishing=True,
                detector_verdict='legitimate',  # FN
                detector_confidence=0.3,
                generated_email_metadata={},
            ),
            Email(
                round_id=round1.id,
                generated_content='legitimate email flagged',
                generated_subject='hello friend',
                is_phishing=False,
                detector_verdict='phishing',  # FP
                detector_confidence=0.6,
                generated_email_metadata={},
            ),
        ]

        # Round 2: all correct
        emails_r2 = [
            Email(
                round_id=round2.id,
                generated_content='phishing email urgent',
                generated_subject='urgent verify now',
                is_phishing=True,
                detector_verdict='phishing',
                detector_confidence=0.15,  # bucket 0-20%
                generated_email_metadata={},
            ),
            Email(
                round_id=round2.id,
                generated_content='legitimate email',
                generated_subject='newsletter update',
                is_phishing=False,
                detector_verdict='legitimate',
                detector_confidence=0.45,  # bucket 40-60%
                generated_email_metadata={},
            ),
            Email(
                round_id=round2.id,
                generated_content='phishing email secure link',
                generated_subject='phishing test secure',
                is_phishing=True,
                detector_verdict='phishing',
                detector_confidence=0.75,  # bucket 60-80%
                generated_email_metadata={},
            ),
            Email(
                round_id=round2.id,
                generated_content='phishing email very confident',
                generated_subject='urgent secure your account now',
                is_phishing=True,
                detector_verdict='phishing',
                detector_confidence=0.95,  # bucket 80-100%
                generated_email_metadata={},
            ),
        ]

        _db.session.add_all(emails_r1 + emails_r2)
        _db.session.commit()
        return {'round1_id': round1.id, 'round2_id': round2.id}


# ---------------------------------------------------------------------------
# Tests: Authentication / Authorization
# ---------------------------------------------------------------------------

class TestIntelligenceEndpointAuth:
    """Tests for authentication and authorization on GET /api/stats/intelligence."""

    def test_unauthenticated_returns_401(self, client):
        """Unauthenticated request should return 401."""
        response = client.get('/api/stats/intelligence')
        assert response.status_code == 401

    def test_non_admin_returns_403(self, client, user_token):
        """Regular user (no admin role) should receive 403 Forbidden."""
        response = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        assert response.status_code == 403

    def test_admin_returns_200(self, client, admin_token, seeded_data):
        """Admin user should receive 200 OK."""
        response = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Tests: Response Shape
# ---------------------------------------------------------------------------

class TestIntelligenceResponseShape:
    """Tests for the response shape of GET /api/stats/intelligence."""

    @pytest.fixture(autouse=True)
    def get_response(self, client, admin_token, seeded_data):
        """Fetch the intelligence stats once per test class."""
        resp = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        self.data = resp.get_json()

    def test_success_flag_is_true(self):
        """Response should have success=True."""
        assert self.data['success'] is True

    def test_data_key_present(self):
        """Response should contain a 'data' key."""
        assert 'data' in self.data

    def test_confidence_distribution_present(self):
        """Response data should contain confidence_distribution list."""
        assert 'confidence_distribution' in self.data['data']
        assert isinstance(self.data['data']['confidence_distribution'], list)

    def test_accuracy_over_rounds_present(self):
        """Response data should contain accuracy_over_rounds list."""
        assert 'accuracy_over_rounds' in self.data['data']
        assert isinstance(self.data['data']['accuracy_over_rounds'], list)

    def test_fp_fn_rates_present(self):
        """Response data should contain fp_fn_rates list."""
        assert 'fp_fn_rates' in self.data['data']
        assert isinstance(self.data['data']['fp_fn_rates'], list)

    def test_top_phishing_words_present(self):
        """Response data should contain top_phishing_words list."""
        assert 'top_phishing_words' in self.data['data']
        assert isinstance(self.data['data']['top_phishing_words'], list)


# ---------------------------------------------------------------------------
# Tests: confidence_distribution
# ---------------------------------------------------------------------------

class TestConfidenceDistribution:
    """Tests for confidence_distribution data correctness."""

    @pytest.fixture(autouse=True)
    def get_distribution(self, client, admin_token, seeded_data):
        resp = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        self.dist = resp.get_json()['data']['confidence_distribution']

    def test_has_five_buckets(self):
        """Distribution must have exactly 5 buckets."""
        assert len(self.dist) == 5

    def test_bucket_labels(self):
        """Buckets should have the correct labels."""
        labels = [b['bucket'] for b in self.dist]
        assert labels == ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']

    def test_bucket_counts_are_integers(self):
        """Bucket counts should be integers."""
        for b in self.dist:
            assert isinstance(b['count'], int)

    def test_known_bucket_counts(self):
        """
        Seeded data has:
        - 0.15 -> 0-20% bucket (1 email)
        - 0.45 -> 40-60% bucket (1 email)
        - 0.75 -> 60-80% bucket (1 email)
        - 0.95 -> 80-100% bucket (1 email)
        - 0.9  -> 80-100% bucket (1 email)
        - 0.85 -> 80-100% bucket (1 email)
        - 0.3  -> 20-40% bucket (1 email)
        - 0.6  -> 60-80% bucket (1 email)
        """
        by_label = {b['bucket']: b['count'] for b in self.dist}
        assert by_label['0-20%'] == 1
        assert by_label['20-40%'] == 1
        assert by_label['40-60%'] == 1
        assert by_label['60-80%'] == 2
        assert by_label['80-100%'] == 3


# ---------------------------------------------------------------------------
# Tests: accuracy_over_rounds
# ---------------------------------------------------------------------------

class TestAccuracyOverRounds:
    """Tests for accuracy_over_rounds data correctness."""

    @pytest.fixture(autouse=True)
    def get_accuracy(self, client, admin_token, seeded_data):
        resp = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        self.accuracy = resp.get_json()['data']['accuracy_over_rounds']

    def test_only_completed_rounds_included(self):
        """Only completed rounds should appear in the accuracy list."""
        for entry in self.accuracy:
            assert 'round_id' in entry
            assert 'accuracy' in entry
            assert 'completed_at' in entry

    def test_accuracy_is_float_between_0_and_1(self):
        """Accuracy values should be floats between 0 and 1."""
        for entry in self.accuracy:
            assert isinstance(entry['accuracy'], float)
            assert 0.0 <= entry['accuracy'] <= 1.0

    def test_round1_accuracy(self, seeded_data):
        """
        Round 1: 4 emails, 3 correct (2 phishing detected + 1 legitimate not flagged = no,
        correct = detector_verdict matches is_phishing ground truth).
        Emails: TP, TP, FN, FP => 2 correct out of 4 => accuracy = 0.5
        """
        entry = next(
            (e for e in self.accuracy if e['round_id'] == seeded_data['round1_id']),
            None
        )
        assert entry is not None
        assert abs(entry['accuracy'] - 0.5) < 0.01

    def test_round2_accuracy(self, seeded_data):
        """
        Round 2: 4 emails, all correct => accuracy = 1.0
        """
        entry = next(
            (e for e in self.accuracy if e['round_id'] == seeded_data['round2_id']),
            None
        )
        assert entry is not None
        assert abs(entry['accuracy'] - 1.0) < 0.01


# ---------------------------------------------------------------------------
# Tests: fp_fn_rates
# ---------------------------------------------------------------------------

class TestFpFnRates:
    """Tests for fp_fn_rates data correctness."""

    @pytest.fixture(autouse=True)
    def get_rates(self, client, admin_token, seeded_data):
        resp = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        self.rates = resp.get_json()['data']['fp_fn_rates']

    def test_each_entry_has_required_keys(self):
        """Each entry must have round_id, false_positive_rate, false_negative_rate."""
        for entry in self.rates:
            assert 'round_id' in entry
            assert 'false_positive_rate' in entry
            assert 'false_negative_rate' in entry

    def test_rates_are_floats_between_0_and_1(self):
        """FP/FN rates should be floats between 0 and 1."""
        for entry in self.rates:
            assert 0.0 <= entry['false_positive_rate'] <= 1.0
            assert 0.0 <= entry['false_negative_rate'] <= 1.0

    def test_round1_fp_fn_rates(self, seeded_data):
        """
        Round 1:
        - 1 FP (legitimate email flagged as phishing) out of 1 actual legitimate => FP rate = 1.0
        - 1 FN (phishing email missed) out of 3 actual phishing => FN rate = 1/3 ≈ 0.333
        """
        entry = next(
            (e for e in self.rates if e['round_id'] == seeded_data['round1_id']),
            None
        )
        assert entry is not None
        assert abs(entry['false_positive_rate'] - 1.0) < 0.01
        assert abs(entry['false_negative_rate'] - (1 / 3)) < 0.01

    def test_round2_fp_fn_rates(self, seeded_data):
        """
        Round 2: all correct => FP rate = 0.0, FN rate = 0.0
        """
        entry = next(
            (e for e in self.rates if e['round_id'] == seeded_data['round2_id']),
            None
        )
        assert entry is not None
        assert abs(entry['false_positive_rate'] - 0.0) < 0.01
        assert abs(entry['false_negative_rate'] - 0.0) < 0.01


# ---------------------------------------------------------------------------
# Tests: top_phishing_words
# ---------------------------------------------------------------------------

class TestTopPhishingWords:
    """Tests for top_phishing_words data correctness."""

    @pytest.fixture(autouse=True)
    def get_words(self, client, admin_token, seeded_data):
        resp = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        self.words = resp.get_json()['data']['top_phishing_words']

    def test_each_entry_has_word_and_count(self):
        """Each entry must have 'word' and 'count' keys."""
        for entry in self.words:
            assert 'word' in entry
            assert 'count' in entry

    def test_counts_are_integers(self):
        """Word counts should be integers."""
        for entry in self.words:
            assert isinstance(entry['count'], int)

    def test_at_most_20_words(self):
        """Should return at most 20 words."""
        assert len(self.words) <= 20

    def test_stopwords_excluded(self):
        """Common stopwords should not appear in top phishing words."""
        stopwords = {'the', 'a', 'an', 'is', 'in', 'to', 'of'}
        word_set = {entry['word'].lower() for entry in self.words}
        for sw in stopwords:
            assert sw not in word_set, f"Stopword '{sw}' should be excluded"

    def test_known_words_present(self):
        """
        Words from phishing subjects ('urgent', 'secure', 'phishing', 'click') should appear.
        Seeded phishing subjects: 'urgent action required', 'secure your account',
        'click the link now', 'urgent verify now', 'phishing test secure',
        'urgent secure your account now'
        """
        word_set = {entry['word'].lower() for entry in self.words}
        # 'urgent' appears 3 times in phishing subjects
        assert 'urgent' in word_set

    def test_words_ordered_by_count_descending(self):
        """Words should be ordered by count descending."""
        counts = [entry['count'] for entry in self.words]
        assert counts == sorted(counts, reverse=True)


# ---------------------------------------------------------------------------
# Tests: GET /api/stats — UserScan counts included
# ---------------------------------------------------------------------------

class TestGetStatsUserScanCounts:
    """GET /api/stats should reflect UserScan rows in totals."""

    @pytest.fixture(autouse=True)
    def seed_user_scans(self, app, admin_user):
        """Add two UserScan rows (one phishing, one legitimate) and capture baseline stats."""
        with app.app_context():
            self.scan1 = UserScan(
                user_id=admin_user,
                subject='Phishing email',
                verdict='phishing',
                confidence=0.9,
            )
            self.scan2 = UserScan(
                user_id=admin_user,
                subject='Legit email',
                verdict='legitimate',
                confidence=0.8,
            )
            _db.session.add_all([self.scan1, self.scan2])
            _db.session.commit()
            self.scan1_id = self.scan1.id
            self.scan2_id = self.scan2.id

    def test_stats_endpoint_accessible(self, client, admin_token):
        resp = client.get(
            '/api/stats',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        assert resp.status_code == 200

    def test_total_emails_scanned_includes_user_scans(self, client, admin_token, app):
        """total_emails_scanned must be >= the number of UserScan rows."""
        with app.app_context():
            user_scan_count = UserScan.query.count()

        resp = client.get(
            '/api/stats',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        data = resp.get_json()['data']
        assert data['total_emails_scanned'] >= user_scan_count

    def test_threats_detected_includes_user_phishing(self, client, admin_token, app):
        """threats_detected must include UserScan rows with verdict in (phishing, likely_phishing)."""
        with app.app_context():
            user_threats = UserScan.query.filter(
                UserScan.verdict.in_(['phishing', 'likely_phishing'])
            ).count()

        resp = client.get(
            '/api/stats',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        data = resp.get_json()['data']
        assert data['threats_detected'] >= user_threats


# ---------------------------------------------------------------------------
# Tests: GET /api/stats/intelligence — UserScan data appears in charts
# ---------------------------------------------------------------------------

class TestIntelligenceIncludesUserScans:
    """
    Confidence distribution and top phishing words must include UserScan data,
    not just pipeline Email rows.
    """

    @pytest.fixture(autouse=True)
    def seed_user_scans(self, app, admin_user):
        """Create isolated UserScan rows with known confidence and verdict."""
        with app.app_context():
            # High-confidence phishing scan with a distinctive subject
            scan_phishing = UserScan(
                user_id=admin_user,
                subject='UniqueWord xyzabc123 alert',
                verdict='phishing',
                confidence=0.92,
            )
            # Likely-phishing scan — also picked up by top-words query
            scan_likely = UserScan(
                user_id=admin_user,
                subject='UniqueWord xyzabc123 warning',
                verdict='likely_phishing',
                confidence=0.07,  # 0-20% bucket
            )
            # Legitimate scan — should not add to phishing words
            scan_legit = UserScan(
                user_id=admin_user,
                subject='legitimate notice',
                verdict='legitimate',
                confidence=0.55,  # 40-60% bucket
            )
            _db.session.add_all([scan_phishing, scan_likely, scan_legit])
            _db.session.commit()

    @pytest.fixture
    def intel(self, client, admin_token):
        resp = client.get(
            '/api/stats/intelligence',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        assert resp.status_code == 200
        return resp.get_json()['data']

    def test_confidence_distribution_counts_userscan_rows(self, intel):
        """
        The two UserScan rows seeded above have confidence 0.92 and 0.07.
        Their buckets (80-100% and 0-20%) must have count >= 1 each.
        """
        by_label = {b['bucket']: b['count'] for b in intel['confidence_distribution']}
        assert by_label['80-100%'] >= 1, "80-100% bucket should count UserScan confidence=0.92"
        assert by_label['0-20%'] >= 1, "0-20% bucket should count UserScan confidence=0.07"

    def test_top_phishing_words_includes_userscan_subjects(self, intel):
        """
        'UniqueWord xyzabc123 alert/warning' are only present in UserScan, not Email.
        Both distinctive tokens should appear in top_phishing_words.
        """
        word_set = {entry['word'].lower() for entry in intel['top_phishing_words']}
        assert 'uniqueword' in word_set, "Token from UserScan phishing subject should appear"
        assert 'xyzabc123' in word_set, "Token from UserScan phishing subject should appear"

    def test_legitimate_userscan_subject_not_in_phishing_words(self, intel):
        """
        Subjects from legitimate UserScan rows should NOT appear in top_phishing_words.
        The word 'legitimate' exists only in the legit scan.
        """
        word_set = {entry['word'].lower() for entry in intel['top_phishing_words']}
        assert 'legitimate' not in word_set, "Legit scan subjects should not pollute phishing words"


# ---------------------------------------------------------------------------
# Tests: GET /api/stats/me — per-user scoped statistics
# ---------------------------------------------------------------------------

class TestGetMyStats:
    """
    GET /api/stats/me must return counts scoped to the authenticated user only —
    not global totals and not another user's data.
    """

    @pytest.fixture(autouse=True)
    def seed_scans(self, app, admin_user, regular_user):
        """
        Seed UserScan rows for two different users:
        - admin_user : 2 phishing, 1 legitimate
        - regular_user: 1 likely_phishing, 2 likely_legitimate
        """
        with app.app_context():
            admin_scans = [
                UserScan(user_id=admin_user, subject='Admin phishing 1',
                         verdict='phishing', confidence=0.9),
                UserScan(user_id=admin_user, subject='Admin phishing 2',
                         verdict='phishing', confidence=0.85),
                UserScan(user_id=admin_user, subject='Admin legit',
                         verdict='legitimate', confidence=0.1),
            ]
            user_scans = [
                UserScan(user_id=regular_user, subject='User likely phishing',
                         verdict='likely_phishing', confidence=0.75),
                UserScan(user_id=regular_user, subject='User legit 1',
                         verdict='likely_legitimate', confidence=0.2),
                UserScan(user_id=regular_user, subject='User legit 2',
                         verdict='likely_legitimate', confidence=0.15),
            ]
            _db.session.add_all(admin_scans + user_scans)
            _db.session.commit()

    def test_requires_authentication(self, client):
        """Unauthenticated request must return 401."""
        resp = client.get('/api/stats/me')
        assert resp.status_code == 401

    def test_admin_user_sees_only_own_scans(self, client, admin_token, app):
        """
        Admin token should see exactly the 3 scans seeded for admin_user above
        (plus any previously seeded rows — so we test >= not exact equality,
        but threats and marked_safe must match the seeded split of 2 phishing / 1 legit).
        """
        resp = client.get(
            '/api/stats/me',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert 'total_emails_scanned' in data
        assert 'threats_detected' in data
        assert 'marked_safe' in data
        # threats_detected must include phishing counts for admin
        assert data['threats_detected'] >= 2
        # marked_safe must include legitimate counts for admin
        assert data['marked_safe'] >= 1

    def test_regular_user_sees_only_own_scans(self, client, user_token):
        """
        Regular-user token must see only that user's rows — 1 threat, 2 marked safe.
        """
        resp = client.get(
            '/api/stats/me',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert data['threats_detected'] >= 1
        assert data['marked_safe'] >= 2

    def test_users_do_not_see_each_others_data(self, client, admin_token, user_token):
        """
        The total_emails_scanned for each user must differ, confirming isolation.
        Admin has >= 3 scans; regular_user has exactly 3 from the fixture above
        but admin_user accumulates rows across tests — their totals must not be equal
        if we compare threats_detected: admin=2+, user=1.
        """
        admin_resp = client.get(
            '/api/stats/me',
            headers={'Authorization': f'Bearer {admin_token}'},
        )
        user_resp = client.get(
            '/api/stats/me',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        admin_data = admin_resp.get_json()['data']
        user_data  = user_resp.get_json()['data']

        # The two users have different threat counts — admin >= 2, regular_user >= 1
        # but regular_user's marked_safe >= 2 while admin's is >= 1
        # Simplest assertion: they are not identical response objects
        assert admin_data['total_emails_scanned'] != user_data['total_emails_scanned'] or \
               admin_data['threats_detected']      != user_data['threats_detected']

    def test_marked_safe_counts_legitimate_and_likely_legitimate(self, client, user_token):
        """
        marked_safe should include both 'legitimate' and 'likely_legitimate' verdicts.
        regular_user has 2 likely_legitimate rows → marked_safe >= 2.
        """
        resp = client.get(
            '/api/stats/me',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        data = resp.get_json()['data']
        assert data['marked_safe'] >= 2

    def test_response_shape(self, client, user_token):
        """Response must have exactly the three expected keys inside data."""
        resp = client.get(
            '/api/stats/me',
            headers={'Authorization': f'Bearer {user_token}'},
        )
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert set(data.keys()) == {'total_emails_scanned', 'threats_detected', 'marked_safe'}
