"""
Celery task using OpenAI Agents SDK orchestrator.

This replaces the manual competition task with SDK-based orchestration.
It supports configurable number of emails and can run multiple rounds.

Key Features:
    - Uses OpenAI Agents SDK for orchestration
    - Configurable email count per round
    - Support for multiple sequential rounds
    - Automatic error handling and recovery
    - Real-time progress logging
"""

from datetime import datetime
from . import celery
from backend.app.models import db, Round
from flask import current_app


@celery.task(bind=True, name='app.tasks.competition_sdk.run_agentic_round')
def run_agentic_round(self, round_id, num_emails=None):
    """
    Run competition round using OpenAI Agents SDK orchestrator.
    
    This is the Celery task that runs in the background.
    It uses the AgenticOrchestrator to coordinate Generator and Detector agents.
    
    Args:
        round_id: Database round ID
        num_emails: Number of emails to process (optional, uses round.total_emails if not provided)
    
    Returns:
        dict: Round results with accuracy, cost, and processing stats
    
    Process:
        1. Fetch round from database
        2. Create orchestrator
        3. Run parallel workflows (Generator → Detector)
        4. Save results to database
        5. Return summary
    
    Example:
        >>> run_agentic_round.delay(round_id=1, num_emails=10)
        # Runs in background, processes 10 emails
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            # ============================================
            # 1. FETCH ROUND
            # ============================================
            
            round_obj = Round.query.get(round_id)
            if not round_obj:
                return {
                    'error': f'Round {round_id} not found',
                    'status': 'failed'
                }
            
            # Use provided num_emails or round's total_emails
            total_emails = num_emails if num_emails is not None else round_obj.total_emails
            
            current_app.logger.info(
                f'[Task] Starting agentic round {round_id} '
                f'with {total_emails} emails'
            )
            
            # Update round status to running
            round_obj.status = 'running'
            round_obj.started_at = datetime.utcnow()
            db.session.commit()
            
            # ============================================
            # 2. RUN ORCHESTRATED WORKFLOW
            # ============================================
            
            # Import here to avoid circular dependency
            from agents_sdk.orchestrator import run_orchestrated_round
            
            # Run the orchestrator (this does all the work!)
            results = run_orchestrated_round(
                round_id=round_id,
                total_emails=total_emails
            )
            
            # ============================================
            # 3. LOG RESULTS
            # ============================================
            
            current_app.logger.info(
                f'[Task] Agentic round {round_id} complete:\n'
                f'  - Processed: {results["total_processed"]}/{total_emails}\n'
                f'  - Succeeded: {results["total_succeeded"]}\n'
                f'  - Failed: {results["total_failed"]}\n'
                f'  - Accuracy: {results["accuracy"]:.2f}%\n'
                f'  - Total Cost: ${results["total_cost"]:.6f}'
            )
            
            return {
                'status': 'completed',
                'round_id': round_id,
                'total_processed': results['total_processed'],
                'total_succeeded': results['total_succeeded'],
                'total_failed': results['total_failed'],
                'accuracy': results['accuracy'],
                'total_cost': results['total_cost']
            }
            
        except Exception as e:
            # ============================================
            # 4. ERROR HANDLING
            # ============================================
            
            error_msg = f'[Task] Agentic round {round_id} failed: {str(e)}'
            current_app.logger.error(error_msg)
            
            # Mark round as failed
            try:
                round_obj = Round.query.get(round_id)
                if round_obj:
                    round_obj.status = 'failed'
                    round_obj.completed_at = datetime.utcnow()
                    db.session.commit()
            except Exception:
                pass
            
            return {
                'status': 'failed',
                'round_id': round_id,
                'error': str(e)
            }


@celery.task(bind=True, name='app.tasks.competition_sdk.run_multiple_rounds')
def run_multiple_rounds(self, num_rounds, emails_per_round):
    """
    Run multiple competition rounds sequentially.
    
    This is useful for large-scale testing or batch processing.
    Each round runs after the previous one completes.
    
    Args:
        num_rounds: How many rounds to run (e.g., 5)
        emails_per_round: How many emails in each round (e.g., 20)
    
    Returns:
        dict: Summary of all rounds with aggregated metrics
    
    Example:
        >>> run_multiple_rounds.delay(num_rounds=5, emails_per_round=20)
        # Creates and runs 5 rounds, 20 emails each
        # Total: 100 emails processed
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            current_app.logger.info(
                f'[Task] Starting {num_rounds} rounds with '
                f'{emails_per_round} emails each'
            )
            
            # Track overall results
            all_results = []
            total_cost = 0.0
            total_accuracy = 0.0
            total_processed = 0
            
            # Run each round
            for round_num in range(1, num_rounds + 1):
                # Create new round
                round_obj = Round(
                    status='pending',
                    total_emails=emails_per_round
                )
                db.session.add(round_obj)
                db.session.commit()
                
                current_app.logger.info(
                    f'[Task] Round {round_num}/{num_rounds}: '
                    f'Created round ID {round_obj.id}'
                )
                
                # Run this round
                result = run_agentic_round(round_obj.id, emails_per_round)
                
                # Track results
                if result['status'] == 'completed':
                    all_results.append(result)
                    total_cost += result['total_cost']
                    total_accuracy += result['accuracy']
                    total_processed += result['total_processed']
                    
                    current_app.logger.info(
                        f'[Task] Round {round_num}/{num_rounds} complete: '
                        f'{result["accuracy"]:.2f}% accuracy, '
                        f'${result["total_cost"]:.6f} cost'
                    )
                else:
                    current_app.logger.error(
                        f'[Task] Round {round_num}/{num_rounds} failed: '
                        f'{result.get("error", "Unknown error")}'
                    )
            
            # Calculate averages
            avg_accuracy = total_accuracy / num_rounds if num_rounds > 0 else 0
            
            current_app.logger.info(
                f'[Task] All {num_rounds} rounds complete:\n'
                f'  - Total emails: {total_processed}\n'
                f'  - Average accuracy: {avg_accuracy:.2f}%\n'
                f'  - Total cost: ${total_cost:.6f}\n'
                f'  - Cost per email: ${total_cost/total_processed:.6f}'
            )
            
            return {
                'status': 'completed',
                'num_rounds': num_rounds,
                'emails_per_round': emails_per_round,
                'total_emails': total_processed,
                'total_cost': total_cost,
                'average_accuracy': avg_accuracy,
                'cost_per_email': total_cost / total_processed if total_processed > 0 else 0,
                'rounds': all_results
            }
            
        except Exception as e:
            error_msg = f'[Task] Multiple rounds failed: {str(e)}'
            current_app.logger.error(error_msg)
            
            return {
                'status': 'failed',
                'error': str(e)
            }