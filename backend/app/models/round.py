"""
Model representing a competition round.

Each round consists off generating N emails, detecting them,
judging the detector's accuracy.
"""

from datetime import datetime
from . import db
from sqlalchemy.orm import validates

class Round(db.Model):
    __tablename__ = 'rounds'

    __table_args__ = (
        db.CheckConstraint('total_emails > 0', name='ck_round_total_emails_positive'),
        db.CheckConstraint('processed_emails >= 0', name='ck_round_processed_emails_nonneg'),
        db.CheckConstraint('processed_emails <= total_emails', name='ck_round_processed_le_total'),
        db.CheckConstraint("status IN ('pending','running','completed','failed')", name='ck_round_status_enum'),
        db.CheckConstraint('detector_accuracy IS NULL OR (detector_accuracy >= 0 AND detector_accuracy <= 100)', name='ck_round_detector_accuracy_range'),
        db.CheckConstraint('generator_success_rate IS NULL OR (generator_success_rate >= 0 AND generator_success_rate <= 100)', name='ck_round_generator_success_range'),
        db.CheckConstraint('avg_confidence_score IS NULL OR (avg_confidence_score >= 0 AND avg_confidence_score <= 100)', name='ck_round_avg_confidence_range'),
        db.CheckConstraint('total_cost >= 0', name='ck_round_total_cost_nonneg'),
    )

    # Primary Column
    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Status column - stores current state of the round
    status = db.Column(
        db.String(20),
        nullable=False
    )

    # Timestamp when round started
    started_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


    # Timestamp when round completed
    completed_at = db.Column(
        db.DateTime,
        nullable=False
    )

    # Total number of emails to process
    total_emails = db.Column(
        db.Integer,
        default=100     # Defaults to 100 if not specified
    )

    # Number of emails processed so far
    processed_emails = db.Column(
        db.Integer,
        default=0
    )

    # Final detector accuracy (percentage)
    detector_accuracy = db.Column(
        db.Float,
        nullable=True   # NULL until round completes
    )

    # Generator success rate (percentage)
    # how often generator fooled the detector
    generator_success_rate = db.Column(
        db.Float,
        nullable=True
    )

    # Average confidence score (percentage)
    avg_confidence_score = db.Column(
        db.Float,
        nullable=True
    )

    # Processing time (seconds)
    processing_time = db.Column(
        db.Integer,
        nullable=True
    )

    # Total API cost for this round (USD)
    total_cost = db.Column(
        db.Float,
        default=0.0
    )

    # ...
    created_by = db.Column(
        db.String(100),
        nullable=True
    )

    # ...
    notes = db.Column(
        db.Text,
        nullable=True
    )

    # RELATIONSHIPS

    # One-to-many relationship with Email model
    # A round has many emails
    emails = db.relationship(
        'Email',                        # Related model name
        backref='round',                # Creates reverse reference: email.round
        lazy='dynamic',                 # Do not load all emails immediately (query when needed)
        cascade='all, delete-orphan'    # Delete emails when round is deleted
    )

    # One-to-many relationship with Log model
    # A round has many log entries
    logs = db.relationship(
        'Log',
        backref='round',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )

    # METHODS
    def __repr__(self):
        """
        String representation of the object (for debugging)
        """
        return f'<Round {self.id} ({self.status})>'

    def to_dict(self):
        """
        Convert model to dictionary (for JSON responses)

        Returns:
            dict: Dictionary representation of the round

        Example:
            >>> round = Round.query.get(1)
            >>> round.to_dict()
            {
                'id': 1,
                'status': 'completed',
                'started_at': '2026-01-29T10:00:00',
                ...
            }
        """

        return {
            'id': self.id,
            'status': self.status,
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'total_emails': self.total_emails,
            'processed_emails': self.processed_emails,
            'detector_accuracy': self.detector_accuracy,
            'generator_success_rate': self.generator_success_rate,
            'avg_confidence_score': self.avg_confidence_score,
            'processing_time': self.processing_time,
            'created_by': self.created_by,
            'notes': self.notes,
            'total_cost': self.total_cost
        }

    def calculate_accuracy(self):
        """
        Calculate detector accuracy for this round.

        Returns:
            float: Accuracy percentage (0-100)
        """

        emails = self.emails.all()

        if not emails:
            return 0.0

        # Count correct detections
        # Since all generated emails are real phishing (is_phishing=True),
        # correct detection means the detector classified them as 'phishing'
        correct = sum(
            1 for email in emails
            if email.detector_verdict == 'phishing'
        )

        # Calculate percentage
        accuracy = (correct/len(emails)) * 100

        return round(accuracy, 2)

    # ORM-level validators
    @validates('processed_emails')
    def validate_processed_emails(self, key, value):
        if value is None:
            return None
        try:
            v = int(value)
        except (TypeError, ValueError):
            raise ValueError('processed_emails must be an integer')
        if v < 0:
            raise ValueError('processed_emails must be >= 0')
        if self.total_emails is not None and v > int(self.total_emails):
            raise ValueError('processed_emails cannot exceed total_emails')
        return v

    @validates('total_emails')
    def validate_total_emails(self, key, value):
        try:
            v = int(value)
        except (TypeError, ValueError):
            raise ValueError('total_emails must be an integer')
        if v <= 0:
            raise ValueError('total_emails must be positive')
        return v

    @validates('status')
    def validate_status(self, key, value):
        if value is None:
            raise ValueError('status is required')
        allowed = {'pending', 'running', 'completed', 'failed'}
        if value not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return value