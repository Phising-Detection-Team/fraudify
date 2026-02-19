"""Health check endpoints."""

from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__, url_prefix='/api')


@health_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint that returns service status."""
    return jsonify({'status': 'healthy', 'service': 'phishing-detection-api'}), 200
