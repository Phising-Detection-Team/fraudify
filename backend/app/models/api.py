"""
    Representing API Calls
"""

from datetime import datetime
from . import db
from sqlalchemy.orm import validates

class API(db.Model):
    __tablename__ = 'api_calls'

    __table_args__ = (
        db.CheckConstraint("agent_type IN ('generator','detector','judge')", name='ck_api_agent_type_enum'),
        db.CheckConstraint('token_used IS NULL OR token_used >= 0', name='ck_api_token_used_nonneg'),
        db.CheckConstraint('cost IS NULL OR cost >= 0', name='ck_api_cost_nonneg'),
        db.CheckConstraint('latency_ms IS NULL OR latency_ms >= 0', name='ck_api_latency_nonneg'),
    )

    # Primary Key
    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Foreign Key
    round_id = db.Column(
        db.Integer,
        db.ForeignKey('rounds.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Email ID (general column, not a foreign key)
    email_id = db.Column(
        db.Integer,
        nullable=True
    )

    # Agent type (generator, detector, judge)
    agent_type = db.Column(db.String(20))

    # Model Name
    model_name = db.Column(db.String(50))

    # Token used
    token_used = db.Column(db.Integer)

    # Cost (USD)
    cost = db.Column(db.Float)

    # latency
    latency_ms = db.Column(db.Integer)

    # When was it created
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
            'round_id': self.round_id,
            'email_id': self.email_id,
            'agent_type': self.agent_type,
            'model_name': self.model_name,
            'token_used': self.token_used,
            'cost': self.cost,
            'latency_ms': self.latency_ms,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @validates('agent_type')
    def validate_agent_type(self, key, value):
        if value is None:
            raise ValueError('agent_type is required')
        allowed = {'generator', 'detector', 'judge'}
        if value not in allowed:
            raise ValueError(f'agent_type must be one of {allowed}')
        return value

    @validates('token_used', 'latency_ms')
    def validate_non_negative_ints(self, key, value):
        if value is None:
            return None
        try:
            v = int(value)
        except (TypeError, ValueError):
            raise ValueError(f'{key} must be an integer')
        if v < 0:
            raise ValueError(f'{key} must be non-negative')
        return v

    @validates('cost')
    def validate_cost(self, key, value):
        if value is None:
                return None
        try:
            v = float(value)
        except (TypeError, ValueError):
            raise ValueError('cost must be a number')
        if v < 0:
            raise ValueError('cost must be non-negative')
        return v