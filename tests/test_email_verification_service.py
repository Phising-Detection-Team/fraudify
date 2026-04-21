"""
Tests for send_verification_email — OTP must NOT appear in the email subject.

C-4 from pre-deployment review. OTPs in subjects are logged by mail gateways,
spam filters, push notification previews, and Resend's own logs.
"""

from unittest.mock import MagicMock, patch

from app.services.email_sender import welcome_email_sender
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


WELCOME_BASE = dict(
    to_email='welcome@example.com',
    display_name='alex_user',
    cta_url='http://localhost:3000/dashboard/user',
    from_email='noreply@sentra.test',
    api_key='re_test_key',
)


class TestWelcomeEmailSender:
    def _send(self, mock_send: MagicMock) -> dict:
        mock_send.return_value = {'id': 'msg-welcome-1'}
        result = welcome_email_sender(**WELCOME_BASE)
        assert result is True
        return mock_send.call_args[0][0]

    def test_success_sends_resend_with_expected_fields(self):
        with patch('resend.Emails.send') as mock_send:
            params = self._send(mock_send)
        assert params['to'] == [WELCOME_BASE['to_email']]
        assert params['from'] == WELCOME_BASE['from_email']
        assert 'welcome' in params['subject'].lower()
        assert 'sentra' in params['subject'].lower()
        assert WELCOME_BASE['display_name'] in params['html']
        assert WELCOME_BASE['cta_url'] in params['html']

    def test_escapes_display_name_in_html(self):
        malicious = '<script>alert(1)</script>'
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'x'}
            welcome_email_sender(**{**WELCOME_BASE, 'display_name': malicious})
        html_out = mock_send.call_args[0][0]['html']
        assert '<script>' not in html_out
        assert '&lt;script&gt;' in html_out

    def test_returns_false_on_send_failure(self):
        with patch('resend.Emails.send', side_effect=Exception('resend down')):
            result = welcome_email_sender(**WELCOME_BASE)
        assert result is False
