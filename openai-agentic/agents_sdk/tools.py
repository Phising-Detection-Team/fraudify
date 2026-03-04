"""
Custom tools for OpenAI Agents SDK to access database.

These tools allow agents to save results to PostgreSQL database.
They are decorated with @function_tool so the Agents SDK can call them.

Why Tools?
    - Agents SDK agents can call Python functions as "tools"
    - Similar to function calling in OpenAI API
    - Allows agents to interact with external systems (database, APIs, etc.)
    - Automatic error handling and retry logic

Available Tools:
    1. save_generated_email() - Save generator output to database
    2. save_detection_result() - Save detector verdict to database
    3. update_round_progress() - Update round status and metrics
"""
from typing import Dict, Any
from flask import current_app
from app.models import db, Email, Round, API
from datetime import datetime


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
    Save generated email to database.
    
    This tool is called by the Generator agent to persist email data.
    It creates an Email record and an API call record for tracking.
    
    Args:
        round_id: Which competition round this email belongs to
        content: Full email text (Subject + Body)
        is_phishing: Ground truth - True if phishing, False if legitimate
        metadata: Additional info (tactics, indicators, difficulty, scenario)
        llm_provider: Which LLM created this ('gemini', 'gpt', 'claude')
        llm_model: Specific model version (e.g., 'gemini-2.0-flash-exp')
        llm_tokens: Total tokens used in generation
        llm_cost: Cost in USD for this generation
    
    Returns:
        dict: Result with success status and email_id if successful
        
    Database Tables Updated:
        - emails: Main email record with content and ground truth
        - api: Tracks this specific API call for analytics
    
    Example:
        >>> result = save_generated_email(
        ...     round_id=1,
        ...     content="Subject: Hello\\n\\nBody text...",
        ...     is_phishing=True,
        ...     metadata={"tactics": ["urgency"]},
        ...     llm_provider='gemini',
        ...     llm_model='gemini-2.0-flash-exp',
        ...     llm_tokens=523,
        ...     llm_cost=0.0002
        ... )
        >>> result['email_id']  # Returns the created email ID
        42
    """
    try:
        # Create Email record
        email = Email(
            round_id=round_id,
            generated_content=content,
            is_phishing=is_phishing,
            generated_metadata=metadata,  # JSON field with tactics, indicators, etc.
            cost=llm_cost  # Initialize cost with generator cost
        )
        
        db.session.add(email)
        db.session.flush()  # Get email.id without committing transaction
        
        # Create API call tracking record
        API.create_call(
            email_id=email.id,
            round_id=round_id,
            agent_type='generator',
            model_name=f"{llm_provider}/{llm_model}",  # e.g., "gemini/gemini-2.0-flash-exp"
            token_used=llm_tokens,
            cost=llm_cost
        )
        
        db.session.commit()
        
        current_app.logger.info(
            f'[Generator] Email {email.id} saved: '
            f'{"Phishing" if is_phishing else "Legitimate"}, '
            f'{llm_tokens} tokens, ${llm_cost:.6f}'
        )
        
        return {
            'success': True,
            'email_id': email.id,
            'round_id': round_id
        }
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'[Generator] Error saving email: {str(e)}')
        return {
            'success': False,
            'error': str(e)
        }

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
    Save detector's verdict to database.
    
    This tool is called by the Detector agent to save analysis results.
    It updates the Email record with detection data and tracks the API call.
    
    Args:
        email_id: Which email was analyzed
        verdict: Detection result ('SCAM', 'LEGITIMATE', etc.)
        confidence: How confident (0.0 to 1.0, e.g., 0.95 = 95%)
        reasoning: Explanation of verdict (2-3 sentences)
        indicators: List of detected indicators/red flags
        llm_provider: Which LLM analyzed this ('claude', 'gpt', 'gemini')
        llm_model: Specific model version (e.g., 'claude-3-5-haiku-20241022')
        llm_tokens: Total tokens used in analysis
        llm_cost: Cost in USD for this analysis
    
    Returns:
        dict: Result with success status and judge verdict
        
    Database Tables Updated:
        - emails: Updates existing email with detector verdict
        - api: Tracks this specific API call
        
    Also Performs:
        - Automatic "judge" logic (compares ground truth vs verdict)
        - Updates email cost (adds detector cost to existing generator cost)
    
    Example:
        >>> result = save_detection_result(
        ...     email_id=42,
        ...     verdict='SCAM',
        ...     confidence=0.87,
        ...     reasoning='Multiple urgency indicators...',
        ...     indicators=['urgency', 'suspicious_link'],
        ...     llm_provider='claude',
        ...     llm_model='claude-3-5-haiku-20241022',
        ...     llm_tokens=892,
        ...     llm_cost=0.0004
        ... )
        >>> result['judge_verdict']  # 'correct' or 'incorrect'
        'correct'
    """
    try:
        # Fetch email record
        email = Email.query.get(email_id)
        if not email:
            return {
                'success': False,
                'error': f'Email {email_id} not found'
            }
        
        # Update email with detector results
        email.detector_verdict = verdict
        email.detector_confidence = confidence
        email.detector_reasoning = reasoning
        email.detector_indicators = indicators  # JSON field
        
        # Calculate risk score (0.0 to 1.0)
        # Map verdict to risk score
        verdict_risk_map = {
            'SCAM': 0.9,
            'LIKELY SCAM': 0.7,
            'SUSPICIOUS': 0.5,
            'LIKELY LEGITIMATE': 0.3,
            'LEGITIMATE': 0.1
        }
        email.detector_risk_score = verdict_risk_map.get(verdict.upper(), 0.5)
        
        # Add detector cost to total email cost
        email.cost = (email.cost or 0.0) + llm_cost
        
        # Create API call tracking record
        API.create_call(
            email_id=email_id,
            round_id=email.round_id,
            agent_type='detector',
            model_name=f"{llm_provider}/{llm_model}",
            token_used=llm_tokens,
            cost=llm_cost
        )
        
        # JUDGE LOGIC (automatic - no LLM needed)
        # Compare ground truth (is_phishing) with detector verdict
        expected = 'SCAM' if email.is_phishing else 'LEGITIMATE'
        
        # Simplified comparison
        verdict_is_phishing = verdict.upper() in ['SCAM', 'LIKELY SCAM']
        is_correct = (verdict_is_phishing == email.is_phishing)
        
        # Set judge verdict
        email.judge_verdict = 'correct' if is_correct else 'incorrect'
        
        # Determine error type if incorrect
        if not is_correct:
            if email.is_phishing and not verdict_is_phishing:
                error_type = 'false_negative'  # Missed phishing (dangerous!)
                severity = 'critical'
            else:
                error_type = 'false_positive'  # Flagged safe email (annoying)
                severity = 'moderate'
            
            email.judge_reasoning = (
                f"INCORRECT: Detector said '{verdict}' but email was '{expected}'. "
                f"Error type: {error_type} ({severity})"
            )
        else:
            email.judge_reasoning = (
                f"CORRECT: Detector correctly identified email as '{verdict}'. "
                f"Matches ground truth: {expected}"
            )
        
        db.session.commit()
        
        current_app.logger.info(
            f'[Detector] Email {email_id} analyzed: '
            f'{verdict} (confidence: {confidence:.2f}), '
            f'Judge: {email.judge_verdict}, '
            f'{llm_tokens} tokens, ${llm_cost:.6f}'
        )
        
        return {
            'success': True,
            'email_id': email_id,
            'verdict': verdict,
            'judge_verdict': email.judge_verdict
        }
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'[Detector] Error saving result: {str(e)}')
        return {
            'success': False,
            'error': str(e)
        }

def update_round_progress(
    round_id: int,
    emails_processed: int,
    total_emails: int,
    accuracy: float = 0.0,
    total_cost: float = 0.0
) -> Dict[str, Any]:
    """
    Update round progress and metrics.
    
    This tool is called periodically to update round status as emails
    are processed. It's called at the end of the workflow to finalize.
    
    Args:
        round_id: Which round to update
        emails_processed: How many emails completed so far
        total_emails: Total emails in this round
        accuracy: Current detection accuracy percentage (0-100)
        total_cost: Total cost so far in USD
    
    Returns:
        dict: Result with success status and current metrics
        
    Database Tables Updated:
        - rounds: Updates processed count, accuracy, cost, status
        
    Status Logic:
        - 'running' if emails_processed < total_emails
        - 'completed' if emails_processed >= total_emails
    
    Example:
        >>> result = update_round_progress(
        ...     round_id=1,
        ...     emails_processed=5,
        ...     total_emails=10,
        ...     accuracy=87.5,
        ...     total_cost=0.0024
        ... )
        >>> result['progress']
        '5/10'
    """
    try:
        # Fetch round record
        round_obj = Round.query.get(round_id)
        if not round_obj:
            return {
                'success': False,
                'error': f'Round {round_id} not found'
            }
        
        # Update processed count
        round_obj.processed_emails = emails_processed
        
        # Update accuracy if provided
        if accuracy is not None:
            round_obj.detector_accuracy = round(accuracy, 2)
        
        # Update cost if provided
        if total_cost is not None:
            round_obj.total_cost = round(total_cost, 6)
        
        # Update status based on progress
        if emails_processed >= total_emails:
            round_obj.status = 'completed'
            round_obj.completed_at = datetime.utcnow()
        else:
            round_obj.status = 'running'
        
        db.session.commit()
        
        current_app.logger.info(
            f'[Round {round_id}] Progress: {emails_processed}/{total_emails}, '
            f'Accuracy: {round_obj.detector_accuracy:.2f}%, '
            f'Cost: ${round_obj.total_cost:.6f}, '
            f'Status: {round_obj.status}'
        )
        
        return {
            'success': True,
            'round_id': round_id,
            'progress': f'{emails_processed}/{total_emails}',
            'accuracy': round_obj.detector_accuracy,
            'cost': round_obj.total_cost,
            'status': round_obj.status
        }
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'[Round {round_id}] Error updating: {str(e)}')
        return {
            'success': False,
            'error': str(e)
        }