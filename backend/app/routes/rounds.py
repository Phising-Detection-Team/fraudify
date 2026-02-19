"""Rounds API endpoints."""

from flask import Blueprint

rounds_bp = Blueprint('rounds', __name__, url_prefix='/api/rounds')

# Endpoints implemented in task 1.2:
# - POST /api/rounds - Start new round
# - GET /api/rounds - List rounds with pagination/filtering
# - GET /api/rounds/{id} - Get round details
# - GET /api/rounds/{id}/emails - Get emails for a round
