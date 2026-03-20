from datetime import datetime, timedelta
from . import db
from sqlalchemy.dialects.postgresql import UUID
import uuid
import string
import random

def generate_random_code(length=12):
    """Generates a random alphanumeric code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

class InviteCode(db.Model):
    __tablename__ = 'invite_codes'

    __table_args__ = (
        # Check constraint: code length should be sufficiently secure
        db.CheckConstraint('LENGTH(code) >= 8', name='ck_invite_code_length'),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False, default=generate_random_code, index=True)
    
    # Creator of the invite code
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    expires_at = db.Column(db.DateTime, nullable=False)
    
    # User who actually used it to sign up
    used_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by])
    user_who_used = db.relationship('User', foreign_keys=[used_by])
    
    def __init__(self, **kwargs):
        super(InviteCode, self).__init__(**kwargs)
        if 'expires_at' not in kwargs and not self.expires_at:
            # Default to 7 days expiry
            self.expires_at = datetime.utcnow() + timedelta(days=7)

    @property
    def is_valid(self):
        """Returns True if code is unexpired and unused"""
        return self.used_at is None and self.expires_at > datetime.utcnow()

    def to_dict(self):
        return {
            'id': str(self.id),
            'code': self.code,
            'created_by': str(self.created_by),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used_by': str(self.used_by) if self.used_by else None,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_valid': self.is_valid
        }

    def __repr__(self):
        return f'<InviteCode {self.code}>'
