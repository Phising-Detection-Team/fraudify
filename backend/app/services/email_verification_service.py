from datetime import datetime, timedelta
import resend
import os
from ..models import db, EmailVerification, User


class EmailVerificationService:
    """Service for handling email verification with Resend API."""

    def __init__(self):
        api_key = os.environ.get('RESEND_API_KEY')
        if not api_key:
            raise ValueError("RESEND_API_KEY not found in environment variables")
        resend.api_key = api_key
        self.from_email = os.environ.get('RESEND_FROM_EMAIL', 'noreply@yourapp.com')
        self.frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

    def send_verification_email(self, user_id: str, user_email: str, user_name: str = None):
        """
        Generate verification code & token, then send email with both options.

        Args:
            user_id: UUID of the user
            user_email: Email address to send verification to
            user_name: Optional user name for personalization

        Returns:
            dict: {success: bool, code: str, message: str}
        """
        try:
            # Check if user exists
            user = User.query.filter_by(id=user_id).first()
            if not user:
                return {"success": False, "error": "User not found"}

            # Check if already verified
            if user.email_verified_at:
                return {"success": False, "error": "Email already verified"}

            # Delete existing verification record if any
            existing = EmailVerification.query.filter_by(user_id=user_id).first()
            if existing:
                db.session.delete(existing)
                db.session.commit()

            # Generate code and token
            code = EmailVerification.generate_verification_code()
            token = EmailVerification.generate_verification_token()

            # Set expiry times
            code_expires_at = datetime.utcnow() + timedelta(minutes=15)
            link_expires_at = datetime.utcnow() + timedelta(hours=24)

            # Create verification record
            verification = EmailVerification(
                user_id=user_id,
                verification_code=code,
                verification_link_token=token,
                code_expires_at=code_expires_at,
                link_expires_at=link_expires_at,
                verification_method_choice='both',
                email_verified_at=None
            )
            db.session.add(verification)
            db.session.commit()

            # Build email content
            verification_link = f"{self.frontend_url}/verify-email?token={token}"
            subject = "Verify Your Email - Sentra"
            html_content = self._build_verification_email_html(
                user_name=user_name or "User",
                code=code,
                verification_link=verification_link,
                code_expires_minutes=15,
                link_expires_hours=24
            )

            # Send email via Resend
            resend.Emails.send({
                "from": self.from_email,
                "to": user_email,
                "subject": subject,
                "html": html_content
            })

            return {
                "success": True,
                "message": f"Verification email sent to {user_email}",
                "code": code  # Return for testing purposes only
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def verify_email_by_code(self, user_id: str, code: str):
        """
        Verify email by code.

        Args:
            user_id: UUID of the user
            code: 6-digit verification code

        Returns:
            dict: {success: bool, message: str}
        """
        try:
            verification = EmailVerification.query.filter_by(
                user_id=user_id,
                verification_code=code
            ).first()

            if not verification:
                return {"success": False, "error": "Invalid verification code"}

            if verification.is_code_expired():
                return {"success": False, "error": "Verification code has expired"}

            # Mark as verified
            verification.email_verified_at = datetime.utcnow()

            # Update user's email_verified_at
            user = User.query.filter_by(id=user_id).first()
            user.email_verified_at = datetime.utcnow()

            db.session.commit()

            return {"success": True, "message": "Email verified successfully"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def verify_email_by_token(self, token: str):
        """
        Verify email by token (from link click).

        Args:
            token: Verification token from email link

        Returns:
            dict: {success: bool, user_id: str, message: str}
        """
        try:
            verification = EmailVerification.query.filter_by(
                verification_link_token=token
            ).first()

            if not verification:
                return {"success": False, "error": "Invalid verification token"}

            if verification.is_link_expired():
                return {"success": False, "error": "Verification link has expired"}

            # Mark as verified
            verification.email_verified_at = datetime.utcnow()

            # Update user's email_verified_at
            user = User.query.filter_by(id=verification.user_id).first()
            user.email_verified_at = datetime.utcnow()

            db.session.commit()

            return {
                "success": True,
                "user_id": str(verification.user_id),
                "message": "Email verified successfully"
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _build_verification_email_html(self, user_name: str, code: str, verification_link: str,
                                       code_expires_minutes: int, link_expires_hours: int):
        """Build HTML email template."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #00d9ff; }}
                .content {{ background: #f5f5f5; padding: 30px; border-radius: 8px; }}
                .code-section {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }}
                .code {{ font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #00d9ff; font-family: monospace; }}
                .divider {{ text-align: center; margin: 30px 0; color: #999; }}
                .button {{ display: inline-block; background: #00d9ff; color: black; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; }}
                .button-section {{ text-align: center; margin: 20px 0; }}
                .expiry {{ color: #666; font-size: 12px; margin-top: 10px; }}
                .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🛡️ Sentra</div>
                </div>

                <div class="content">
                    <p>Hi {user_name},</p>

                    <p>Welcome to Sentra! To complete your email verification, please use one of the following methods:</p>

                    <h3>Method 1: Use This Code</h3>
                    <div class="code-section">
                        <p>Enter this 6-digit code:</p>
                        <div class="code">{code}</div>
                        <p class="expiry">Code expires in {code_expires_minutes} minutes</p>
                    </div>

                    <div class="divider">— OR —</div>

                    <h3>Method 2: Click The Link</h3>
                    <div class="button-section">
                        <a href="{verification_link}" class="button">Verify Email</a>
                        <p class="expiry">Link expires in {link_expires_hours} hours</p>
                    </div>

                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        If you didn't request this verification, please ignore this email.
                    </p>
                </div>

                <div class="footer">
                    <p>© 2026 Sentra. All rights reserved.</p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
