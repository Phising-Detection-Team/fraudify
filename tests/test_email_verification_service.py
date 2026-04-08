"""
Tests for send_verification_email — OTP must NOT appear in the email subject.

C-4 from pre-deployment review. OTPs in subjects are logged by mail gateways,
spam filters, push notification previews, and Resend's own logs.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services.email_verification_service import send_verification_email

CODE = '472819'
BASE_ARGS = dict(
    to_email='user@example.com',
    token='safe-url-token',
    code=CODE,
    frontend_url='http://localhost:3000',
    from_email='noreply@sentra.test',
    api_key='re_test_key',
)


class TestSendVerificationEmail:
    def _send(self, mock_send: MagicMock) -> dict:
        """Run send_verification_email and return the params dict sent to Resend."""
        mock_send.return_value = {'id': 'msg-001'}
        result = send_verification_email(**BASE_ARGS)
        assert result is True, 'send_verification_email should return True on success'
        return mock_send.call_args[0][0]

    def test_subject_does_not_contain_otp(self):
        """C-4: OTP must not be embedded in the email subject line."""
        with patch('resend.Emails.send') as mock_send:
            params = self._send(mock_send)
        assert CODE not in params['subject'], (
            f"OTP '{CODE}' must NOT appear in subject: {params['subject']!r}"
        )

    def test_subject_is_generic_verification_phrase(self):
        """Subject should mention 'verification code' but omit the actual digits."""
        with patch('resend.Emails.send') as mock_send:
            params = self._send(mock_send)
        assert 'verification code' in params['subject'].lower()

    def test_otp_is_present_in_email_body(self):
        """OTP must still appear in the HTML body so the user can read it."""
        with patch('resend.Emails.send') as mock_send:
            params = self._send(mock_send)
        assert CODE in params['html'], 'OTP must appear in the HTML body'

    def test_returns_false_on_send_failure(self):
        """Service must return False when Resend raises an exception."""
        with patch('resend.Emails.send', side_effect=Exception('network error')):
            result = send_verification_email(**BASE_ARGS)
        assert result is False
