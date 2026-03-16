"""Emails API endpoints."""

from flask import Blueprint

emails_bp = Blueprint('emails', __name__, url_prefix='/api/emails')

# Endpoints implemented in task 1.3:
# - GET /api/emails/{id} - Get email details
# - POST /api/emails/{id}/override - Override email verdict
