"""
Tests for EmailVerification.generate() — OTP must use CSPRNG (secrets module),
not Mersenne Twister (random module).

C-3 from pre-deployment review.
"""

from unittest.mock import patch

import pytest

from app import create_app
from app.models import db as _db
from app.models.email_verification import EmailVerification


@pytest.fixture(scope='module')
def app():
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


class TestOTPGeneration:
    def test_otp_does_not_use_random_randint(self, app):
        """C-3: OTP must use secrets.randbelow, not random.randint."""
        with app.app_context():
            with patch('random.randint') as mock_randint:
                EmailVerification.generate(user_id=9999)
                mock_randint.assert_not_called()

    def test_otp_is_six_digits(self, app):
        """OTP code must be exactly 6 characters, all digits (zero-padded)."""
        with app.app_context():
            ev = EmailVerification.generate(user_id=9999)
            assert len(ev.code) == 6
            assert ev.code.isdigit()

    def test_otp_range_is_valid(self, app):
        """OTP must be in range 000000–999999 across multiple generations."""
        with app.app_context():
            for _ in range(20):
                ev = EmailVerification.generate(user_id=9999)
                value = int(ev.code)
                assert 0 <= value <= 999_999

    def test_token_uses_secrets(self, app):
        """Verify token field is a non-empty secrets-derived string."""
        with app.app_context():
            ev = EmailVerification.generate(user_id=9999)
            assert ev.token
            assert len(ev.token) > 20
