"""
Celery worker entrypoint.

Run with:
    celery -A celery_worker worker --loglevel=info --concurrency=2
"""

from app import create_app, celery  # noqa: F401 — celery must be imported for autodiscovery

flask_app = create_app()
flask_app.app_context().push()
