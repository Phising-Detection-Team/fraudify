from datetime import datetime
import re
import bcrypt
import sqlalchemy as sa
from . import db


class User(db.Model):
    """User account model with bcrypt password hashing."""

    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(30), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    email_verified = db.Column(db.Boolean, default=False, server_default=sa.false(), nullable=False)
    password_reset_token = db.Column(db.String(128), unique=True, nullable=True, index=True)
    password_reset_expires = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    # Explicit primaryjoin/secondaryjoin because user_roles has two FK columns to users
    roles = db.relationship(
        'Role',
        secondary='user_roles',
        primaryjoin='User.id == user_roles.c.user_id',
        secondaryjoin='Role.id == user_roles.c.role_id',
        back_populates='users',
        lazy='selectin',
    )
    invite_codes_created = db.relationship(
        'InviteCode', foreign_keys='InviteCode.created_by', back_populates='creator', lazy='dynamic'
    )

    def set_password(self, password: str) -> None:
        """Hash and store password. Enforces minimum policy."""
        if len(password) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Za-z]', password):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', password):
            raise ValueError('Password must contain at least one digit')
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, plain_password: str) -> bool:
        """Verify plain password against stored hash."""
        return bcrypt.checkpw(plain_password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def has_role(self, role_name: str) -> bool:
        """Check whether user has a specific role."""
        return any(r.name == role_name for r in self.roles)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'is_active': self.is_active,
            'email_verified': self.email_verified,
            'roles': [r.name for r in self.roles],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<User {self.username} ({self.email})>'
