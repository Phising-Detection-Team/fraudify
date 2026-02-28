"""
Celery task using OpenAI Agents SDK orchestrator.

This replaces your manual competition task.
"""

from datetime import datetime
from . import celery
from ..models import db, Round
from flask import current_app


@celery.task(bind=True, name='app.tasks.competition_sdk.run_agentic_round')
def run_agentic_round(self, round_id):
    """
    Run competition round using OpenAI Agents SDK orchestrator.
    
    This is the new task that uses the SDK for orchestration.
    
    Args:
        round_id: Database round ID
    
    Returns:
        dict: Round results
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            # Get round
            round_obj = Round.query.get(round_id)
            if not round_obj:
                return {'error': f'Round {round_id} not found'}
            
            current_app.logger.info(
                f'Starting agentic round {round_id} with {round_obj.total_emails} emails'
            )
            
            # Import here to avoid circular dependency
            from app.agents_sdk.orchestrator import run_orchestrated_round
            
            # Run orchestrated workflow
            results = run_orchestrated_round(
                round_id=round_id,
                total_emails=round_obj.total_emails
            )
            
            current_app.logger.info(
                f'Agentic round {round_id} complete: '
                f'{results["total_succeeded"]}/{results["total_processed"]} succeeded, '
                f'Accuracy: {results["accuracy"]:.2f}%, '
                f'Cost: ${results["total_cost"]:.4f}'
            )
            
            return results
            
        except Exception as e:
            error_msg = f'Agentic round {round_id} failed: {str(e)}'
            current_app.logger.error(error_msg)
            
            try:
                round_obj = Round.query.get(round_id)
                if round_obj:
                    round_obj.status = 'failed'
                    round_obj.completed_at = datetime.utcnow()
                    db.session.commit()
            except Exception:
                pass
            
            return {
                'round_id': round_id,
                'status': 'failed',
                'error': str(e)
            }