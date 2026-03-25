"""Flask application entry point."""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from app import create_app, socketio

# Create Flask app
app = create_app()


if __name__ == '__main__':
    # Run with Flask-SocketIO
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=app.config.get('DEBUG', False),
        allow_unsafe_werkzeug=True,  # Allow development server
    )
