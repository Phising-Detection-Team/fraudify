"""Marshmallow schemas for auth endpoint request validation."""

import re
from marshmallow import Schema, fields, validates, validates_schema, ValidationError, EXCLUDE


class SignupSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    email = fields.Email(required=True, error_messages={'required': 'Email is required'})
    username = fields.Str(required=True, error_messages={'required': 'Username is required'})
    password = fields.Str(required=True, load_only=True, error_messages={'required': 'Password is required'})

    @validates('username')
    def validate_username(self, value, **kwargs):
        if len(value) < 3 or len(value) > 30:
            raise ValidationError('Username must be between 3 and 30 characters')
        if not re.match(r'^[A-Za-z0-9_]+$', value):
            raise ValidationError('Username may only contain letters, digits, and underscores')

    @validates('password')
    def validate_password(self, value, **kwargs):
        if len(value) < 8:
            raise ValidationError('Password must be at least 8 characters')
        if not re.search(r'[A-Za-z]', value):
            raise ValidationError('Password must contain at least one letter')
        if not re.search(r'\d', value):
            raise ValidationError('Password must contain at least one digit')


class LoginSchema(Schema):
    email = fields.Email(required=True, error_messages={'required': 'Email is required'})
    password = fields.Str(required=True, load_only=True, error_messages={'required': 'Password is required'})


class InviteCodeSchema(Schema):
    role_name = fields.Str(required=True, error_messages={'required': 'role_name is required'})
    expires_in_days = fields.Int(load_default=7)

    @validates('role_name')
    def validate_role_name(self, value, **kwargs):
        from app.models import Role
        if value not in Role.VALID_NAMES:
            raise ValidationError(f'role_name must be one of: {sorted(Role.VALID_NAMES)}')

    @validates('expires_in_days')
    def validate_expires_in_days(self, value, **kwargs):
        if value < 1 or value > 365:
            raise ValidationError('expires_in_days must be between 1 and 365')
