"""Flask application entry point.

Run with: python run.py
Production: gunicorn run:app
"""

import os
from dotenv import load_dotenv

load_dotenv()

from app import create_app, socketio

app = create_app()

if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=app.config.get('DEBUG', False),
        allow_unsafe_werkzeug=True,
    )
