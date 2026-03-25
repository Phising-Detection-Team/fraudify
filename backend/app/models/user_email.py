from datetime import datetime
from . import db
from sqlalchemy.dialects.postgresql import UUID
import uuid

class UserEmail(db.Model):
    """
    Model representing an actual user's email synced from their provider (Gmail/Outlook)
    All sensitive fields are stored symmetrically encrypted.
    """

    __tablename__ = 'user_emails'
    
    __table_args__ = (
        db.CheckConstraint("provider IN ('gmail', 'outlook')", name='ck_user_email_provider_enum'),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    provider = db.Column(db.String(20), nullable=False)
    
    # Store the provider's native ID to prevent re-fetching/duplication
    source_id = db.Column(db.String(255), nullable=False)
    
    # ENCRYPTED FIELDS
    encrypted_subject = db.Column(db.Text, nullable=True)
    encrypted_body = db.Column(db.Text, nullable=True)
    encrypted_sender = db.Column(db.Text, nullable=True)
    
    # Metadata
    received_at = db.Column(db.DateTime, nullable=True)
    
    # Flag to indicate if the user consented to model training when this was fetched
    flagged_for_training = db.Column(db.Boolean, default=False, nullable=False)
    
    # Analysis Status (could link out to a separate analysis table later but kept simple here)
    is_scanned = db.Column(db.Boolean, default=False, nullable=False)
    detected_phishing = db.Column(db.Boolean, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = db.relationship('User', backref=db.backref('user_emails', lazy=True, cascade="all, delete-orphan"))

    def to_dict(self):
        # NOTE: This does NOT return the decrypted payload directly!
        # It's intentional so we don't accidentally leak plain text through JSON APIs.
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'provider': self.provider,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'is_scanned': self.is_scanned,
            'detected_phishing': self.detected_phishing,
            'flagged_for_training': self.flagged_for_training,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<UserEmail {self.id} (User: {self.user_id}, Provider: {self.provider})>'