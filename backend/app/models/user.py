from datetime import datetime
import re

from sqlalchemy.orm import validates
from . import db
import bcrypt
from sqlalchemy.dialects.postgresql import UUID
import uuid

class User(db.Model):
    __tablename__ = 'users'

    # TABLE-LEVEL CONSTRAINTS
    __table_args__ = (
        # Check constraint: email must contain @
        db.CheckConstraint(
            "email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'",
            name='ck_user_email_format'
        ),

        # Check constraint: password_hash must be bcrypt format (60 chars)
        db.CheckConstraint(
            "LENGTH(password_hash) = 60",
            name='ck_user_password_hash_length'
        ),
        
        # Ensure email is lowercase (prevents case-sensitivity issues)
        db.CheckConstraint(
            "email = LOWER(email)",
            name='ck_user_email_lowercase'
        ),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    admin = db.relationship('Admin', back_populates='user', uselist=False, cascade='all, delete-orphan')
    email_permissions = db.relationship('EmailPermission', back_populates='user', cascade='all, delete-orphan')
    emails = db.relationship('Email', back_populates='owner', passive_deletes=True)
    
    # Discuss more about 2 functions, do we need them? If we do, we can move them to a utils file and import here, or just keep them here for now since they are user-specific.
    '''
    def set_password(self, password):
        """Hashes the password and stores it."""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        """Verifies the password against the stored hash."""
        # Check if password_hash exists and matches
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    '''

    # APPLICATION-LEVEL METHODS
    @validates('email')
    def validate_email(self, key, value):
        """Validates that the email is in a proper format and is not empty."""
        if not value:
            raise ValueError("Email is required")
        
        value = value.lower().strip()

        # Regex pattern for email validation
        email_pattern = r'^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
        if not re.match(email_pattern, value):
            raise ValueError('Invalid email format')
    
        if len(value) > 255:
            raise ValueError("Email must be 255 characters or less")
        
        return value
    
    @validates('password_hash')
    def validate_password_hash(self, key, value):
        """Validates that the password hash is in a proper format and is not empty."""
        if not value:
            raise ValueError("Password hash is required")
        
        if len(value) != 60:
            raise ValueError("Password hash must be 60 characters long (bcrypt format)")
        
        if not value.startswith(('$2a$', '$2b$', '$2y$')):
            raise ValueError('Invalid bcrypt hash format')
        
        return value
    
    @validates('is_active')
    def validate_is_active(self, key, value):
        """Ensure is_active is boolean"""
        if value is None:
            raise ValueError('is_active cannot be None')
        
        if not isinstance(value, bool):
            raise ValueError('is_active must be a boolean')
        
        return value
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'is_active': self.is_active,
            'is_admin': self.admin is not None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<User {self.email} active={self.is_active}>'
