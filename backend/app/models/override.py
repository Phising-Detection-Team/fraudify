"""
    Model representing human mannually override the results
"""

from datetime import datetime
from . import db
from sqlalchemy.orm import validates

class Override(db.Model):
    __tablename__ = 'overrides'

    __table_args__ = (
        db.CheckConstraint("verdict IN ('correct','incorrect','phishing','legitimate')", name='ck_override_verdict_enum'),
        db.UniqueConstraint('email_id', name='uq_override_email_id'),
    )

    # Primary Key
    id = db.Column(db.Integer, primary_key=True)

    # Foreign Key
    email_id = db.Column(
        db.Integer,
        db.ForeignKey('emails.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Verdict result
    verdict = db.Column(
        db.String(20),
        nullable=False
    )

    # Who overrode this
    overridden_by = db.Column(
        db.String(100),
        nullable=True
    )

    # Reason for the manual override
    reason = db.Column(
        db.Text,
        nullable=True
    )

    # When was this created
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # METHODS
    def __repr__(self):
        """String representing for debugging"""
        # !!! NEEDED TO DESIGN OUTPUT !!!
        return f''

    def to_dict(self):
        """Converting to dictionary for JSON responses"""
        return {
            'id': self.id,
            'email_id': self.email_id,
            'verdict': self.verdict,
            'overridden_by': self.overridden_by,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @validates('verdict')
    def validate_verdict(self, key, value):
        if value is None:
            raise ValueError('verdict is required')
        allowed = {'correct', 'incorrect', 'phishing', 'legitimate'}
        if value not in allowed:
            raise ValueError(f'verdict must be one of {allowed}')
        return value

    @validates('email_id')
    def validate_email_id(self, key, value):
        try:
            v = int(value)
        except (TypeError, ValueError):
            raise ValueError('email_id must be an integer')
        if v <= 0:
            raise ValueError('email_id must be positive')
        return v
