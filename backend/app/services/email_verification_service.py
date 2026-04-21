"""Email verification service using Resend API."""

import logging

from app.services.email_sender import render_sentra_html_email

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, token: str, code: str, frontend_url: str, from_email: str, api_key: str) -> bool:
    """
    Send a verification email containing a 6-digit code and a clickable link.

    Both the link and the code are valid for 15 minutes.

    Args:
        to_email:     Recipient email address
        token:        URL-safe token for link-based verification
        code:         6-digit numeric code for manual entry
        frontend_url: Base URL of the frontend (e.g. http://localhost:3000)
        from_email:   Sender address (e.g. "SentraAI <noreply@sentra.quest>")
        api_key:      Resend API key

    Returns:
        True on success, False on failure (non-fatal — caller should log/warn).
    """
    try:
        import resend

        resend.api_key = api_key

        verify_link = f'{frontend_url.rstrip("/")}/verify-email?token={token}'
        html_body = render_sentra_html_email(
            'Verify your Sentra email',
            'email/verification_inner.html',
            code=code,
            verify_link=verify_link,
        )

        params = {
            'from': from_email,
            'to': [to_email],
            'subject': 'Your Sentra verification code',
            'html': html_body,
        }

        resend.Emails.send(params)
        logger.info('Verification email sent to %s', to_email)
        return True

    except Exception as exc:
        logger.error('Failed to send verification email to %s: %s', to_email, exc)
        return False
