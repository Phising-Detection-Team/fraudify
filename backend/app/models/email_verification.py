from datetime import datetime, timedelta
import re
import secrets
import string

from sqlalchemy.orm import validates
from . import db
from sqlalchemy.dialects.postgresql import UUID
import uuid


class EmailVerification(db.Model):
    __tablename__ = 'email_verifications'

    __table_args__ = (
        db.CheckConstraint(
            "verification_method_choice IN ('link', 'code', 'both')",
            name='ck_email_verification_method'
        ),
        db.UniqueConstraint('user_id', name='uq_email_verification_user_id'),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)

    # OTP Code: 6-digit numeric string
    verification_code = db.Column(db.String(6), nullable=False)

    # Token for link-based verification
    verification_link_token = db.Column(db.String(128), nullable=False, unique=True, index=True)

    # Verification timestamps
    email_verified_at = db.Column(db.DateTime, nullable=True)  # NULL until verified
    code_expires_at = db.Column(db.DateTime, nullable=False)
    link_expires_at = db.Column(db.DateTime, nullable=False)

    # How user can verify
    verification_method_choice = db.Column(db.String(10), nullable=False, default='both')

    # Tracking
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', back_populates='email_verification')

    @validates('verification_code')
    def validate_verification_code(self, key, value):
        """Ensures code is 6 digits."""
        if not value or len(value) != 6 or not value.isdigit():
            raise ValueError("Verification code must be exactly 6 digits")
        return value

    @validates('verification_link_token')
    def validate_verification_link_token(self, key, value):
        """Ensures token is not empty."""
        if not value or len(value) < 32:
            raise ValueError("Verification link token must be at least 32 characters")
        return value

    @validates('verification_method_choice')
    def validate_verification_method(self, key, value):
        """Validates verification method."""
        if value not in ['link', 'code', 'both']:
            raise ValueError("verification_method_choice must be 'link', 'code', or 'both'")
        return value

    @staticmethod
    def generate_verification_code():
        """Generate a 6-digit numeric code."""
        return ''.join(secrets.choice(string.digits) for _ in range(6))

    @staticmethod
    def generate_verification_token():
        """Generate a secure random token for email link."""
        return secrets.token_urlsafe(32)

    def is_code_expired(self):
        """Check if verification code has expired."""
        return datetime.utcnow() > self.code_expires_at

    def is_link_expired(self):
        """Check if verification link has expired."""
        return datetime.utcnow() > self.link_expires_at

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'verification_method_choice': self.verification_method_choice,
            'email_verified_at': self.email_verified_at.isoformat() if self.email_verified_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<EmailVerification user_id={self.user_id} verified={self.email_verified_at is not None}>'
