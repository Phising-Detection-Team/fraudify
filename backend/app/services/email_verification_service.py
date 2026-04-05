"""Email verification service using Resend API."""

import logging

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

        html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Sentra email</title>
  <style>
    body {{ margin: 0; padding: 0; background: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e2e8f0; }}
    .container {{ max-width: 480px; margin: 40px auto; padding: 40px; background: #13131a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }}
    .logo {{ font-size: 22px; font-weight: 700; color: #22d3ee; letter-spacing: -0.5px; margin-bottom: 24px; }}
    h1 {{ font-size: 20px; font-weight: 600; margin: 0 0 12px; }}
    p {{ font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }}
    .code-box {{ background: #1e1e2e; border: 1px solid rgba(34,211,238,0.2); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }}
    .code {{ font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #22d3ee; font-family: monospace; }}
    .btn {{ display: inline-block; background: linear-gradient(135deg, #22d3ee, #a855f7); color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 8px 0; }}
    .divider {{ border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0; }}
    .expiry {{ font-size: 12px; color: #64748b; text-align: center; }}
    .footer {{ font-size: 12px; color: #475569; margin-top: 32px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Sentra</div>
    <h1>Verify your email address</h1>
    <p>Welcome to Sentra! To complete your signup and start protecting your inbox from phishing threats, please verify your email address.</p>

    <p style="margin-bottom: 8px;">Enter this code on the verification page:</p>
    <div class="code-box">
      <div class="code">{code}</div>
    </div>

    <p class="expiry">⏱ This code expires in <strong>15 minutes</strong></p>

    <hr class="divider" />

    <p>Or click the button below to verify automatically:</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="{verify_link}" class="btn">Verify my email →</a>
    </div>

    <p class="expiry">⏱ This link also expires in <strong>15 minutes</strong></p>

    <div class="footer">
      <p>If you didn't create a Sentra account, you can safely ignore this email.</p>
      <p>© Sentra — Phishing Detection &amp; Protection</p>
    </div>
  </div>
</body>
</html>
"""

        params = {
            'from': from_email,
            'to': [to_email],
            'subject': f'Your Sentra verification code: {code}',
            'html': html_body,
        }

        resend.Emails.send(params)
        logger.info('Verification email sent to %s', to_email)
        return True

    except Exception as exc:
        logger.error('Failed to send verification email to %s: %s', to_email, exc)
        return False
