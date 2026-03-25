from datetime import datetime
from sqlalchemy.orm import validates
from . import db
from sqlalchemy.dialects.postgresql import UUID
import uuid

class TrainingDataLog(db.Model):
    __tablename__ = 'training_data_logs'

    __table_args__ = (
        db.CheckConstraint("action IN ('ingested','removed')", name='ck_training_data_log_action_enum'),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    
    # We still keep email_id as integer if Email table's ID is integer 
    # (Email id = db.Column(db.Integer, primary_key=True) in email.py)
    email_id = db.Column(db.Integer, db.ForeignKey('emails.id', ondelete='CASCADE'), nullable=False, index=True)
    
    ingested_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.String(20), nullable=False) # 'ingested' or 'removed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    email = db.relationship('Email')
    user = db.relationship('User')

    @validates('action')
    def validate_action(self, key, value):
        if value not in ['ingested', 'removed']:
            raise ValueError("action must be 'ingested' or 'removed'")
        return value

    def to_dict(self):
        return {
            'id': str(self.id),
            'email_id': self.email_id,
            'ingested_by': str(self.ingested_by) if self.ingested_by else None,
            'action': self.action,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<TrainingDataLog {self.id} (Email: {self.email_id}, Action: {self.action})>'
