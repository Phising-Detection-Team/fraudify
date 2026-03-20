from datetime import datetime
from sqlalchemy.orm import validates
from . import db
from sqlalchemy.dialects.postgresql import UUID

class Admin(db.Model):
    __tablename__ = 'admins'

    # The user_id is the primary key and foreign key to Users
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    
    # Store the user who created this admin (optional)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationship back to the user
    user = db.relationship('User', back_populates='admin', foreign_keys=[user_id])
    
    # Optional relationship to track who created this admin
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'user_id': str(self.user_id),
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Admin user_id={self.user_id}>'
