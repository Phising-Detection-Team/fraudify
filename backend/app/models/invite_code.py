import secrets
from datetime import datetime, timedelta
from . import db


class InviteCode(db.Model):
    """Invite code that grants a specific role to the registering user."""

    __tablename__ = 'invite_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id', ondelete='CASCADE'), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    creator = db.relationship('User', foreign_keys=[created_by], back_populates='invite_codes_created')
    role = db.relationship('Role', lazy='selectin')

    @staticmethod
    def generate(created_by: int, role_id: int, expires_in_days: int = 7) -> 'InviteCode':
        """Create a new InviteCode with a random URL-safe token."""
        return InviteCode(
            code=secrets.token_urlsafe(32),
            created_by=created_by,
            role_id=role_id,
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days),
        )

    def is_valid(self) -> bool:
        """True if the code has not been used and has not expired."""
        return self.used_by is None and datetime.utcnow() < self.expires_at

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'code': self.code,
            'role': self.role.name if self.role else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used': self.used_by is not None,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<InviteCode {self.code[:8]}… (role={self.role_id})>'
