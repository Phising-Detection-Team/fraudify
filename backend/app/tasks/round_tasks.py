"""
Celery task for running AI orchestration rounds asynchronously.

Replaces the threading.Thread pattern in the rounds route.
"""

import asyncio

from app import celery


@celery.task(bind=True, name='tasks.run_round')
def run_round_task(self, round_id: int, total_emails: int, parallel_workflows: int = 2) -> dict:
    """
    Run a training round asynchronously via OpenAI Agents orchestration.

    Args:
        round_id:            ID of the Round to process
        total_emails:        Number of emails in the round
        parallel_workflows:  Number of parallel agent workflows

    Returns:
        dict with status and round_id
    """
    import os
    import sys

    self.update_state(state='STARTED', meta={'status': 'running', 'round_id': round_id})

    # Ensure openai-agentic is on the path (mirrors scan_tasks pattern)
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    oa_dir = os.path.join(root, 'openai-agentic')
    if root not in sys.path:
        sys.path.insert(0, root)
    if oa_dir not in sys.path:
        sys.path.insert(0, oa_dir)

    from app.services.openai_orchestration_runner import run_openai_round_in_thread
    from app import create_app

    app = create_app()
    run_openai_round_in_thread(app, round_id, total_emails, parallel_workflows)

    return {'status': 'complete', 'round_id': round_id}
