"""Custom exceptions and error response utilities."""

from flask import jsonify


class AppError(Exception):
    """Base application error."""

    def __init__(self, message, status_code=400, error_code=None, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or 'UNKNOWN_ERROR'
        self.details = details or {}

    def to_dict(self):
        return {
            'error': self.error_code,
            'message': self.message,
            'details': self.details,
        }


class ValidationError(AppError):
    """Request validation error."""

    def __init__(self, message, details=None):
        super().__init__(message, status_code=400, error_code='VALIDATION_ERROR', details=details)


class RoundNotFoundError(AppError):
    """Round not found error."""

    def __init__(self, round_id):
        super().__init__(
            f'Round with id {round_id} not found',
            status_code=404,
            error_code='ROUND_NOT_FOUND',
            details={'round_id': round_id},
        )


class RoundInProgressError(AppError):
    """Round is already in progress."""

    def __init__(self, round_id):
        super().__init__(
            f'Round {round_id} is already running',
            status_code=409,
            error_code='ROUND_IN_PROGRESS',
            details={'round_id': round_id},
        )


class EmailNotFoundError(AppError):
    """Email not found error."""

    def __init__(self, email_id):
        super().__init__(
            f'Email with id {email_id} not found',
            status_code=404,
            error_code='EMAIL_NOT_FOUND',
            details={'email_id': email_id},
        )


def error_response(error_code, message, status_code=400, details=None):
    """Generate a consistent JSON error response."""
    return jsonify({'error': error_code, 'message': message, 'details': details or {}}), status_code
