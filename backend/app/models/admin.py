"""Admin model."""

from datetime import datetime, timezone
from . import db
from sqlalchemy.dialects.postgresql import UUID
import uuid


class Admin(db.Model):
    __tablename__ = 'admins'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship('User', back_populates='admin', foreign_keys=[user_id])
