"""
Custom tools for OpenAI Agents SDK to access database.
These tools allow agents to save results to PostgreSQL.
"""

"""A tool that wraps a function. In most cases, you should use  the `function_tool` helpers to
create a FunctionTool, as they let you easily wrap a Python function.
The wrapped function can be called by an agent, and the tool will handle the input/output"""
from agents.tool import function_tool

from typing import Dict, Any
from flask import current_app
from backend.app.models import db, Email, Round, API
from datetime import datetime


@function_tool
def save_generated_email(
    round_id: int,
    content: str,
    is_phishing: bool,
    metadata: Dict[str, Any],
    llm_provider: str,
    llm_model: str,
    llm_tokens: int,
    llm_cost: float
) -> Dict[str, Any]:
    """
    Save a generated email.  provider/model/tokens/cost are recorded in the
    API table; the Email record only keeps the generated text/metadata and the
    running cost.
    """
    try:
        email = Email(
            round_id=round_id,
            generated_content=content,
            is_phishing=is_phishing,
            generated_email_metadata=metadata,
            cost=llm_cost,            # total cost for this email so far
        )

        db.session.add(email)
        db.session.flush()            # get ID without committing

        API.create_call(
            email_id=email.id,
            round_id=round_id,
            agent_type='generator',
            model_name=f"{llm_provider}/{llm_model}",
            token_used=llm_tokens,
            cost=llm_cost
        )

        db.session.commit()
        current_app.logger.info(f'Generated email saved: ID {email.id}')
        return {'success': True, 'email_id': email.id, 'round_id': round_id}

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error saving generated email: {e}')
        return {'success': False, 'error': str(e)}


@function_tool
def save_detection_result(
    email_id: int,
    verdict: str,
    confidence: float,
    reasoning: str,
    indicators: list,
    llm_provider: str,
    llm_model: str,
    llm_tokens: int,
    llm_cost: float
) -> Dict[str, Any]:
    """
    Save a detector’s verdict.  Again, the expensive LLM details go into the API
    table; the Email record is updated with the verdict/confidence/reasoning
    and the cost is incremented.
    """
    try:
        email = Email.query.get(email_id)
        if not email:
            return {'success': False, 'error': f'Email {email_id} not found'}

        email.detector_verdict = verdict
        email.detector_confidence = confidence
        email.detector_reasoning = reasoning
        email.detector_risk_score = None          # compute if needed
        email.cost = (email.cost or 0.0) + llm_cost

        API.create_call(
            email_id=email_id,
            round_id=email.round_id,
            agent_type='detector',
            model_name=f"{llm_provider}/{llm_model}",
            token_used=llm_tokens,
            cost=llm_cost
        )

        db.session.commit()
        current_app.logger.info(
            f'Detection saved for email {email_id}: {verdict} ({confidence:.2f})'
        )
        return {'success': True,
                'email_id': email_id,
                'verdict': verdict,
                'judge_verdict': getattr(email, 'judge_verdict', None)}
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error saving detection: {e}')
        return {'success': False, 'error': str(e)}


@function_tool
def update_round_progress(
    round_id: int,
    emails_processed: int,
    total_emails: int,
    accuracy: float = None,
    total_cost: float = None
) -> Dict[str, Any]:
    """
    Update round progress in database.
    
    Args:
        round_id: Round to update
        emails_processed: Number of emails completed
        total_emails: Total emails in round
        accuracy: Current accuracy percentage (optional)
        total_cost: Total cost so far (optional)
    
    Returns:
        dict: Update status
    """
    try:
        round_obj = Round.query.get(round_id)
        if not round_obj:
            return {'success': False, 'error': f'Round {round_id} not found'}
        
        round_obj.processed_emails = emails_processed
        
        if accuracy is not None:
            round_obj.detector_accuracy = accuracy
        
        if total_cost is not None:
            round_obj.total_cost = total_cost
        
        # Update status
        if emails_processed >= total_emails:
            round_obj.status = 'completed'
            round_obj.completed_at = datetime.utcnow()
        else:
            round_obj.status = 'running'
        
        db.session.commit()
        
        current_app.logger.info(
            f'Round {round_id} progress: {emails_processed}/{total_emails}'
        )
        
        return {
            'success': True,
            'round_id': round_id,
            'progress': f'{emails_processed}/{total_emails}',
            'accuracy': accuracy
        }
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating round: {str(e)}')
        return {
            'success': False,
            'error': str(e)
        }