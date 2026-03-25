"""
Database utilities for OpenAI Agents SDK implementation.

Compatible with existing backend structure but adapted for:
- OpenAI Agents SDK (agents library)
- Generator Agent (Gemini 2.0 Flash)
- Detector Agent (Claude 3.5 Haiku)

Key Changes from Semantic Kernel version:
1. Removed Semantic Kernel-specific imports
2. Adapted for OpenAI Agents SDK response format
3. Simplified API call tracking (no retry logic needed - SDK handles it)
4. Direct integration with agents.Runner results
"""

import os
import sys
from dotenv import load_dotenv
from datetime import datetime
from typing import Dict, Any, Optional

load_dotenv()

# Load environment variables FIRST
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_file = os.path.join(project_root, '.env')
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    print(f"⚠️  Warning: .env file not found at {env_file}")

# Add project root to sys.path to resolve backend imports
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import backend modules
from backend.app import create_app
from backend.app.models import db, API, Email, Round, Log

# Global Flask app instance
_app = None
_app_context = None

def init_db() -> None:
    """
    Initialize Flask app and database connection.
    
    This should be called once at application startup.
    Uses the backend's create_app() to properly initialize everything.
    """
    global _app, _app_context

    if _app is not None:
        return  # Already initialized

    # Ensure backend is in sys.path
    backend_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'backend'
    )
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    # Create Flask app with proper config
    _app = create_app(config_name='development')
    
    # Push app context and keep it active
    _app_context = _app.app_context()
    _app_context.push()
    
    database_url = os.getenv('PROD_DATABASE_URL') or os.getenv('DEV_DATABASE_URL')
    masked_url = database_url.split('@')[1] if '@' in database_url else '...'
    print(f"Connecting to database: {masked_url}")
    print(f"Database connection initialized")

def get_db():
    '''Get the database instance'''
    return db

def save_log(
    level: str,
    message: str,
    round_id: int = None,
    context: dict = None
) -> bool:
    """
    Persist a log entry to the database logs table.
    
    Args:
        level: Log level (info, warning, error, critical)
        message: Log message
        round_id: Optional round ID to associate with the log
        context: Optional context dictionary for additional metadata
    
    Returns:
        bool: True if successful, False otherwise
    """
    if _app is None:
        return False

    try:
        Log.create_log(level=level, message=message, round_id=round_id, context=context)
        return True
    except Exception:
        return False


def save_api_call(
    round_id: int,
    agent_type: str,
    model_name: str,
    token_used: int,
    cost: float,
    latency_ms: int,
    email_id: int = None
) -> bool:
    """
    Log an API call to the database.
    
    Args:
        round_id: ID of the round this API call belongs to
        agent_type: Type of agent ('generator' or 'detector')
        model_name: Name of the model used (e.g., 'gemini/gemini-2.0-flash-exp')
        token_used: Total tokens used in the API call
        cost: Cost in USD
        latency_ms: Latency in milliseconds
        email_id: Optional email ID if associated with specific email
    
    Returns:
        bool: True if successful, False otherwise
    """
    if _app is None:
        print("Database not initialized. Call init_db() first.")
        return False

    try:
        # Verify round exists
        if round_id is not None:
            round_exists = db.session.get(Round, round_id)
            if not round_exists:
                print(f"Round {round_id} does not exist. Skipping API call logging.")
                return False

        # Create API record
        api_record = API(
            email_id=email_id,
            round_id=round_id,
            agent_type=agent_type,
            model_name=model_name,
            token_used=token_used,
            cost=cost,
            latency_ms=latency_ms
        )

        db.session.add(api_record)
        db.session.commit()

        return True

    except Exception as e:
        msg = f"Failed to log API call to database: {e}"
        print(f"{msg}")
        save_log('error', msg, round_id=round_id)
        db.session.rollback()
        return False


def save_generated_email(
    round_id: int,
    content: str,
    prompt: str,
    subject: str,
    body: str,
    is_phishing: bool,
    metadata: Dict[str, Any],
    llm_provider: str,
    llm_model: str,
    llm_tokens: int,
    llm_cost: float,
    latency_ms: int
) -> Optional[int]:
    """
    Save generated email to database.
    
    This creates an Email record with generator data only.
    Detector data will be added later via update_email_with_detection().
    
    Args:
        round_id: Which round this email belongs to
        content: Full email text (Subject + Body)
        prompt: Prompt used to generate email
        subject: Email subject line
        body: Email body text
        is_phishing: Ground truth (True if phishing, False if legitimate)
        metadata: Additional metadata (tactics, indicators, etc.)
        llm_provider: Which LLM generated this ('gemini', 'gpt', 'claude')
        llm_model: Specific model version
        llm_tokens: Total tokens used
        llm_cost: Cost in USD
        latency_ms: Generation latency in milliseconds
    
    Returns:
        int: Email ID if successful, None otherwise
    """
    if _app is None:
        print("Database not initialized. Call init_db() first.")
        return None

    try:
        # Create Email record (detector fields will be NULL initially)
        email_record = Email(
            round_id=round_id,
            generated_content=content,
            generated_prompt=prompt,
            generated_subject=subject[:100] if subject else subject,  # VARCHAR(100) limit
            generated_body=body,
            is_phishing=bool(is_phishing),
            generated_email_metadata=metadata if metadata else {},
            generator_latency_ms=latency_ms,
            cost=llm_cost,
            # Detector fields - set temporary value to satisfy constraint
            detector_verdict='phishing',  # Temporary, will be updated
            created_at=datetime.utcnow()
        )

        db.session.add(email_record)
        db.session.flush()  # Get email ID

        # Log API call
        save_api_call(
            round_id=round_id,
            email_id=email_record.id,
            agent_type='generator',
            model_name=f"{llm_provider}/{llm_model}",
            token_used=llm_tokens,
            cost=llm_cost,
            latency_ms=latency_ms
        )

        db.session.commit()

        print(f"Email {email_record.id} saved: "
              f"{'Phishing' if is_phishing else 'Legitimate'}, "
              f"{llm_tokens} tokens, ${llm_cost:.6f}")

        return email_record.id

    except Exception as e:
        msg = f"Failed to save generated email: {e}"
        print(f"{msg}")
        save_log('error', msg, round_id=round_id)
        db.session.rollback()
        return None


def update_email_with_detection(
    email_id: int,
    verdict: str,
    confidence: float,
    risk_score: float,
    reasoning: str,
    llm_provider: str,
    llm_model: str,
    llm_tokens: int,
    llm_cost: float,
    latency_ms: int,
    processing_time: float
) -> bool:
    """
    Update email with detector results and perform automatic judging.
    
    NO Judge agent - uses simple comparison logic.
    
    Args:
        email_id: Which email to update
        verdict: Detection verdict ('phishing' or 'legitimate')
        confidence: Confidence level (0.0 to 1.0)
        risk_score: Risk score (0.0 to 1.0)
        reasoning: Detector's reasoning/explanation
        llm_provider: Which LLM detected this ('claude', 'gpt', 'gemini')
        llm_model: Specific model version
        llm_tokens: Total tokens used
        llm_cost: Cost in USD
        latency_ms: Detection latency in milliseconds
        processing_time: Total processing time for this email (seconds)
    
    Returns:
        bool: True if detector was correct, False if incorrect
    """
    if _app is None:
        print("Database not initialized. Call init_db() first.")
        return False

    try:
        # Get email record
        email_record = db.session.get(Email, email_id)
        if not email_record:
            print(f"Email {email_id} not found")
            return False

        # Update with detector results
        email_record.detector_verdict = verdict
        email_record.detector_confidence = confidence
        email_record.detector_risk_score = risk_score
        email_record.detector_reasoning = reasoning
        email_record.detector_latency_ms = latency_ms
        email_record.processing_time = processing_time
        email_record.cost += llm_cost

        # Compare: (verdict == 'phishing') with is_phishing
        is_correct = (verdict == 'phishing') == email_record.is_phishing

        # Log API call
        save_api_call(
            round_id=email_record.round_id,
            email_id=email_id,
            agent_type='detector',
            model_name=f"{llm_provider}/{llm_model}",
            token_used=llm_tokens,
            cost=llm_cost,
            latency_ms=latency_ms
        )

        db.session.commit()

        print(f"✅ Detection saved for email {email_id}: "
              f"{verdict} ({confidence:.2f}), "
              f"{'Correct' if is_correct else 'Incorrect'}")

        return is_correct

    except Exception as e:
        msg = f"Failed to update email with detection: {e}"
        print(f"❌ {msg}")
        save_log('error', msg, round_id=email_record.round_id if 'email_record' in locals() else None)
        db.session.rollback()
        return False


def create_round(
    total_emails: int,
    status: str = 'running',
    created_by: str = None,
    notes: str = None
) -> Optional[int]:
    """
    Create a new round in the database.
    
    Args:
        total_emails: Total number of emails to generate in this round
        status: Initial status (default: 'running')
        created_by: Optional username who created this round
        notes: Optional notes about this round
    
    Returns:
        int: Round ID if successful, None otherwise
    """
    if _app is None:
        print("Database not initialized. Call init_db() first.")
        return None

    try:
        round_record = Round(
            status=status,
            total_emails=total_emails,
            processed_emails=0,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            created_by=created_by,
            notes=notes
        )

        db.session.add(round_record)
        db.session.flush()
        db.session.commit()

        print(f"✅ Round {round_record.id} created: {total_emails} emails")
        return round_record.id

    except Exception as e:
        msg = f"Failed to create round: {e}"
        print(f"❌ {msg}")
        save_log('error', msg)
        db.session.rollback()
        return None


def update_round(
    round_id: int,
    status: str = None,
    processed_emails: int = None,
    detector_accuracy: float = None,
    generator_success_rate: float = None,
    avg_confidence_score: float = None,
    processing_time: int = None,
    total_cost: float = None
) -> bool:
    """
    Update an existing round in the database.
    
    Args:
        round_id: ID of the round to update
        status: Updated status ('pending', 'running', 'completed', 'failed')
        processed_emails: Number of emails processed
        detector_accuracy: Detector accuracy percentage (0-100)
        generator_success_rate: Generator success rate percentage (0-100)
        avg_confidence_score: Average confidence score percentage (0-100)
        processing_time: Processing time in seconds
        total_cost: Total cost in USD
    
    Returns:
        bool: True if successful, False otherwise
    """
    if _app is None:
        print("Database not initialized. Call init_db() first.")
        return False

    try:
        round_record = db.session.get(Round, round_id)
        if not round_record:
            print(f"Round {round_id} not found")
            return False

        # Update fields if provided
        if status is not None:
            round_record.status = status
        if processed_emails is not None:
            round_record.processed_emails = processed_emails
        if detector_accuracy is not None:
            round_record.detector_accuracy = detector_accuracy
        if generator_success_rate is not None:
            round_record.generator_success_rate = generator_success_rate
        if avg_confidence_score is not None:
            round_record.avg_confidence_score = avg_confidence_score
        if processing_time is not None:
            round_record.processing_time = processing_time
        if total_cost is not None:
            round_record.total_cost = total_cost

        # Set completed_at if completing
        if status == 'completed':
            round_record.completed_at = datetime.utcnow()

        db.session.commit()

        accuracy_str = f", Accuracy: {detector_accuracy:.2f}%" if detector_accuracy is not None else ""
        print(f"Round {round_id} updated: {processed_emails}/{round_record.total_emails}{accuracy_str}")

        return True

    except Exception as e:
        msg = f"Failed to update round: {e}"
        print(f"{msg}")
        save_log('error', msg, round_id=round_id)
        db.session.rollback()
        return False


def get_round_summary(round_id: int) -> Dict[str, Any]:
    """
    Get comprehensive summary of a round.
    
    Args:
        round_id: Round to summarize
    
    Returns:
        dict: Round summary with all metrics
    """
    if _app is None:
        return {}

    try:
        round_record = db.session.get(Round, round_id)
        if not round_record:
            return {}

        # Get email statistics
        emails = db.session.query(Email).filter_by(round_id=round_id).all()

        correct_count = sum(
            1 for e in emails
            if (e.detector_verdict == 'phishing') == e.is_phishing
        )

        false_positives = sum(
            1 for e in emails
            if not e.is_phishing and e.detector_verdict == 'phishing'
        )

        false_negatives = sum(
            1 for e in emails
            if e.is_phishing and e.detector_verdict == 'legitimate'
        )

        return {
            'round_id': round_id,
            'status': round_record.status,
            'total_emails': round_record.total_emails,
            'processed_emails': round_record.processed_emails,
            'accuracy': round_record.detector_accuracy or 0.0,
            'total_cost': round_record.total_cost,
            'correct_count': correct_count,
            'incorrect_count': len(emails) - correct_count,
            'false_positives': false_positives,
            'false_negatives': false_negatives,
            'started_at': round_record.started_at,
            'completed_at': round_record.completed_at
        }

    except Exception as e:
        print(f"❌ Failed to get round summary: {e}")
        return {}


def get_all_rounds_summary() -> list:
    """Get summary of all rounds."""
    if _app is None:
        return []

    try:
        rounds = db.session.query(Round).order_by(Round.id.desc()).all()

        return [{
            'id': r.id,
            'status': r.status,
            'total_emails': r.total_emails,
            'processed_emails': r.processed_emails,
            'accuracy': r.detector_accuracy or 0.0,
            'total_cost': r.total_cost,
            'started_at': r.started_at,
            'completed_at': r.completed_at
        } for r in rounds]

    except Exception as e:
        print(f"Failed to get rounds summary: {e}")
        return []