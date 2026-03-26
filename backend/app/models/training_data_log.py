from datetime import datetime
from . import db


class TrainingDataLog(db.Model):
    """Tracks ingestion/removal events for training data."""

    __tablename__ = 'training_data_logs'

    VALID_ACTIONS = {'ingested', 'removed'}

    id = db.Column(db.Integer, primary_key=True)
    email_id = db.Column(db.Integer, db.ForeignKey('emails.id', ondelete='CASCADE'), nullable=False, index=True)
    ingested_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    action = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'email_id': self.email_id,
            'ingested_by': self.ingested_by,
            'action': self.action,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<TrainingDataLog email={self.email_id} action={self.action}>'
