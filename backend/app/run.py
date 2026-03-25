"""
Application entry point - start the Flask server.
"""

import os
from app import create_app, db

# Create Flask app
app = create_app(config_env=os.environ.get('FLASK_ENV', 'development'))

if __name__ == '__main__':
    # Run development server
    # Use 'flask run' or 'python -m flask run' in production
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('FLASK_ENV') == 'development'
    )
