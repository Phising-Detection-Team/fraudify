from datetime import datetime
from . import db
from sqlalchemy.orm import validates

class Email(db.Model):
    """
    Model representing a single email in a competition round

    Lifecycle:
    1. Generator creats email with is_phishing flag
    2. Detector analyzes and provides verdict + reasoning
    3. Judge compares detector verdict to actual flag
    4. Optional: Human can override judge verdict
    """

    __tablename__ = 'emails'
    __table_args__ = (
        db.CheckConstraint('detector_confidence >= 0 AND detector_confidence <= 1', name='ck_email_detector_confidence_range'),
        db.CheckConstraint('generator_latency_ms IS NULL OR generator_latency_ms >= 0', name='ck_email_generator_latency_nonneg'),
        db.CheckConstraint('detector_latency_ms IS NULL OR detector_latency_ms >= 0', name='ck_email_detector_latency_nonneg'),
        db.CheckConstraint('cost IS NULL OR cost >= 0', name='ck_email_cost_nonneg'),
        db.CheckConstraint("detector_verdict IN ('phishing','legitimate')", name='ck_email_detector_verdict_enum'),
        db.CheckConstraint('processing_time IS NULL OR processing_time >= 0', name='ck_email_processing_time_nonneg'),
    )

    # PRIMARY KEY
    id = db.Column(db.Integer, primary_key=True)

    # FOREIGN KEY
    round_id = db.Column(
        db.Integer,
        db.ForeignKey('rounds.id', ondelete='CASCADE'),
        nullable=False,
        index=True          # Faster look up
    )

    # GENERATOR OUTPUTS

    generated_content = db.Column(
        db.Text,
        nullable=False
    )

    generated_prompt = db.Column(
        db.Text,
        nullable=True
    )

    generated_subject = db.Column(
        db.String(100),
        nullable=True
    )

    generated_body = db.Column(
        db.Text,
        nullable=True
    )

    # Ground truth: is this actually a phishing email?
    # Set by generator, used by judge for evaluation
    is_phishing = db.Column(
        db.Boolean,
        nullable=False
    )

    # Stored as JSON for flexibility
    # Example: {
    #   "subject": "Urgent: Verify your account",
    #   "sender": "support@fake-bank.com",
    #   "links": ["http://malicious-site.com"],
    #   "attachments": ["invoice.exe"]
    # }
    generated_email_metadata = db.Column(
        db.JSON,
        nullable=False
    )

    # Generator latency (ms)
    # Note: Column name has typo in initial schema; should be generator_latency_ms
    generator_latency_ms = db.Column(
        db.Integer,
        nullable=True
    )

    # DETECTOR OUTPUTS

    # Detector verdict (phishing or not)
    detector_verdict = db.Column(
        db.String(20),
        nullable=False
    )

    # Detector risk score (higher -> more risk)
    detector_risk_score = db.Column(
        db.Float,
        nullable=True
    )

    # Detector's confidence (0.0 to 1.0) -> Higher = more confident
    detector_confidence = db.Column(
        db.Float,
        nullable=True
    )

    # Detector's explanation of its decision
    # Example: "Contains urgency keywords an suspicious link"
    detector_reasoning = db.Column(
        db.Text,
        nullable=True
    )

    # Detector latency in ms
    detector_latency_ms = db.Column(
        db.Integer,
        nullable=True
    )

    # Decided not to use Judge agent for now since it may be redundant with detector confidence + reasoning
    """
    # JUDGE OUTPUTS

    # Judge ground truth (minimum truth?)
    judge_ground_truth = db.Column(
        db.String(20),
        nullable=False
    )

    # Verify judge
    is_judge_correct = db.Column(
        db.Boolean,
        nullable=False
    )

    # Judge quality score (higher -> more accurate)
    judge_quality_score = db.Column(
        db.Integer,
        nullable=False
    )

    # Judge's verdict: " correct" or "incorrect"
    # Compares detector_verdict with is_phishing
    judge_verdict =db.Column(
        db.String(20),
        nullable=False
    )

    # Judge's explanation
    # Example: "Detector correctly identified phishing indicators"
    judge_reasoning = db.Column(
        db.Text,
        nullable=True
    )

    # Judge latency in ms
    judge_latency_ms = db.Column(
        db.Integer,
        nullable=True
    )
    """

    # MANUALLY OVERRIDE
    # Was this overridden by human?
    manual_override = db.Column(
        db.Boolean,
        nullable=True
    )
    # Human's override verdict (if manual)
    override_verdict = db.Column(
        db.String(20),
        nullable=True
    )

    # Reason for override
    override_reason = db.Column(
        db.Text,
        nullable=True
    )

    # Who overrode the verdict
    overridden_by = db.Column(
        db.String(100),
        nullable=True
    )

    # When was it overridden
    overridden_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # METADATA

    # When this email record was created
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # Processing time (seconds)
    # How long did it take to generate, detect?
    processing_time = db.Column(
        db.Float,
        nullable=True
    )

    # API cost for this email (USD)
    # Sum generator + detector
    cost = db.Column(
        db.Float,
        default=0.0
    )

    # METHODS
    def __repr__(self):
        """String representation for debugging"""
        return f"<Email {self.id} (Round {self.round_id})>"

    def to_dict(self):
        """Convert to dictionary for JSON responses"""
        return {
            'id': self.id,
            'round_id': self.round_id,
            'generated_prompt': self.generated_prompt,
            'generated_email_subject': self.generated_subject,
            'generated_email_body': self.generated_body,
            'is_phishing': self.is_phishing,
            'generated_email_metadata': self.generated_email_metadata,
            'generator_latency_ms': self.generator_latency_ms,
            'detector_verdict': self.detector_verdict,
            'detector_confidence': self.detector_confidence,
            'detector_risk_score': self.detector_risk_score,
            'detector_reasoning': self.detector_reasoning,
            'detector_latency_ms': self.detector_latency_ms,
            'manual_override': self.manual_override,
            'override_verdict': self.override_verdict,
            'override_reason': self.override_reason,
            'overridden_by': self.overridden_by,
            'overridden_at': self.overridden_at,
            'created_at': self.created_at,
            'processing_time': self.processing_time,
            'cost': self.cost
        }

    def get_final_verdict(self):
        """
        Get the final verdict (considering manual overrides)

        Returns:
            str: "correct" or "incorrect"
        """

        if self.manual_override:
            return self.override_verdict

        if self.detector_verdict:
            return self.detector_verdict

    # ORM-level validators
    @validates('detector_confidence')
    def validate_detector_confidence(self, key, value):
        if value is None:
            return None
        try:
            value = float(value)
        except (TypeError, ValueError):
            raise ValueError('detector_confidence must be a float between 0 and 1')
        if not (0.0 <= value <= 1.0):
            raise ValueError('detector_confidence must be between 0 and 1')
        return value

    @validates('detector_verdict')
    def validate_detector_verdict(self, key, value):
        if value is None:
            raise ValueError('detector_verdict is required')
        allowed = {'phishing', 'legitimate'}
        if value not in allowed:
            raise ValueError(f"detector_verdict must be one of {allowed}")
        return value

    @validates('generator_latency_ms', 'detector_latency_ms')
    def validate_latency(self, key, value):
        if value is None:
            return None
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise ValueError(f'{key} must be an integer (ms)')
        if value < 0:
            raise ValueError(f'{key} must be non-negative')
        return value

    @validates('cost', 'detector_risk_score', 'processing_time')
    def validate_non_negative_floats(self, key, value):
        if value is None:
            return None
        try:
            val = float(value)
        except (TypeError, ValueError):
            raise ValueError(f'{key} must be a number')
        if val < 0:
            raise ValueError(f'{key} must be non-negative')
        return val

    @validates('is_phishing')
    def validate_is_phishing(self, key, value):
        if not isinstance(value, bool):
            raise ValueError('is_phishing must be a boolean')
        return value

    def is_false_positive(self):
        """
        Check if this is a false positive (Says it phishing but it is legitimate)

        Returns:
            bool: True if false positive
        """

        return (
            not self.is_phishing and
            self.detector_verdict == "phishing"
        )

    def is_false_negative(self):
        """
        Check if this is a false negative
        """

        return (
            self.is_phishing and
            self.detector_verdict == "legitimate"
        )
