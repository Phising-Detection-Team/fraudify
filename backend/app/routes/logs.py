"""Logs and system info API endpoints."""

from flask import Blueprint

logs_bp = Blueprint('logs', __name__, url_prefix='/api')

# Endpoints implemented in task 1.4:
# - GET /api/logs - Get system logs with filtering
# - GET /api/costs - Get cost breakdown
