from datetime import datetime
from sqlalchemy.orm import validates
from . import db
from sqlalchemy.dialects.postgresql import UUID
import uuid

class EmailPermission(db.Model):
    __tablename__ = 'email_permissions'

    __table_args__ = (
        db.CheckConstraint("provider IN ('gmail', 'outlook')", name='ck_email_permission_provider_enum'),
        db.CheckConstraint("scope IN ('read', 'read_and_train')", name='ck_email_permission_scope_enum'),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    provider = db.Column(db.String(20), nullable=False)
    access_token = db.Column(db.String(2048), nullable=False)
    refresh_token = db.Column(db.String(2048), nullable=True)
    scope = db.Column(db.String(50), nullable=False)
    
    consent_given_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', back_populates='email_permissions')

    @validates('provider')
    def validate_provider(self, key, value):
        if value not in ['gmail', 'outlook']:
            raise ValueError("provider must be 'gmail' or 'outlook'")
        return value

    @validates('scope')
    def validate_scope(self, key, value):
        if value not in ['read', 'read_and_train']:
            raise ValueError("scope must be 'read' or 'read_and_train'")
        return value

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'provider': self.provider,
            'scope': self.scope,
            'consent_given_at': self.consent_given_at.isoformat() if self.consent_given_at else None,
            'revoked_at': self.revoked_at.isoformat() if self.revoked_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<EmailPermission {self.provider} scope={self.scope}>'
