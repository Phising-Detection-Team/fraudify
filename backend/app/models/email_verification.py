import secrets
import random
from datetime import datetime, timedelta

from . import db


class EmailVerification(db.Model):
    """Tracks email verification tokens and 6-digit codes for signup."""

    __tablename__ = 'email_verifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    code = db.Column(db.String(6), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    is_used = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship('User', backref=db.backref('email_verifications', lazy='dynamic', cascade='all, delete-orphan'))

    @classmethod
    def generate(cls, user_id: int) -> 'EmailVerification':
        """
        Invalidate any existing unused records for this user, then create a new one.
        Returns the new EmailVerification instance (not yet added to session).
        """
        # Invalidate old unused records
        cls.query.filter_by(user_id=user_id, is_used=False).update({'is_used': True})

        token = secrets.token_urlsafe(32)
        code = f'{random.randint(0, 999999):06d}'
        expires_at = datetime.utcnow() + timedelta(minutes=15)

        return cls(
            user_id=user_id,
            token=token,
            code=code,
            expires_at=expires_at,
        )

    def is_valid(self) -> bool:
        """Return True if this record has not been used and has not expired."""
        return not self.is_used and datetime.utcnow() < self.expires_at

    def __repr__(self):
        return f'<EmailVerification user_id={self.user_id} used={self.is_used}>'
