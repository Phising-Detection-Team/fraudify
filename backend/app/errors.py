"""
Error handlers for the Flask application.

Provides:
- Custom exception classes (ValidationError, NotFoundError, etc.)
- Global error handlers that return consistent JSON responses
- All errors logged to database via Log model
"""

from flask import jsonify
import traceback


# ---------------------
# Custom Exceptions
# ---------------------

class AppError(Exception):
    """Base exception for all application errors."""
    status_code = 500

    def __init__(self, message, status_code=None, payload=None):
        super().__init__()
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload or {}


class ValidationError(AppError):
    """Raised when request data fails validation (400)."""
    status_code = 400


class NotFoundError(AppError):
    """Raised when a resource is not found (404)."""
    status_code = 404


class ConflictError(AppError):
    """Raised when there's a resource conflict (409). E.g. round already running."""
    status_code = 409


# ---------------------
# Error Response Format
# ---------------------

def error_response(code, message, details=None):
    """Build a consistent error JSON response."""
    response = {
        'success': False,
        'error': {
            'code': code,
            'message': message,
        }
    }
    if details:
        response['error']['details'] = details
    return response


# ---------------------
# Log error to database
# ---------------------

def log_error_to_db(level, message, context=None):
    """Log an error to the Logs table. Silently fails if DB not available."""
    try:
        from app.models import Log, db
        log = Log(
            level=level,
            message=message,
            context=context
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        pass


# ---------------------
# Register handlers on app
# ---------------------

def register_error_handlers(app):
    """Register all error handlers on the Flask app."""

    @app.errorhandler(AppError)
    def handle_app_error(e):
        """Handle custom application exceptions."""
        log_error_to_db(
            level='warning' if e.status_code < 500 else 'error',
            message=e.message,
            context={
                'error_type': e.__class__.__name__,
                'status_code': e.status_code,
                'payload': e.payload
            }
        )
        return jsonify(error_response(
            code=e.__class__.__name__,
            message=e.message,
            details=e.payload if e.payload else None
        )), e.status_code

    @app.errorhandler(400)
    def handle_400(e):
        """Bad Request -- invalid input from client."""
        log_error_to_db(level='warning', message=f'400 Bad Request: {e}')
        return jsonify(error_response(
            code='BAD_REQUEST',
            message=str(e.description) if hasattr(e, 'description') else 'Bad request'
        )), 400

    @app.errorhandler(404)
    def handle_404(e):
        """Not Found -- resource or route does not exist."""
        log_error_to_db(level='warning', message=f'404 Not Found: {e}')
        return jsonify(error_response(
            code='NOT_FOUND',
            message='The requested resource was not found'
        )), 404

    @app.errorhandler(405)
    def handle_405(e):
        """Method Not Allowed."""
        return jsonify(error_response(
            code='METHOD_NOT_ALLOWED',
            message='This HTTP method is not allowed for this endpoint'
        )), 405

    @app.errorhandler(500)
    def handle_500(e):
        """Internal Server Error -- unexpected failure."""
        log_error_to_db(
            level='error',
            message=f'500 Internal Server Error: {e}',
            context={'traceback': traceback.format_exc()}
        )
        return jsonify(error_response(
            code='INTERNAL_SERVER_ERROR',
            message='An unexpected error occurred'
        )), 500
