"""
Database utilities for LLM services.

Provides database connection and logging functionality for API calls.
"""

# MUST load environment variables FIRST, before importing anything from backend
import os
import sys
from dotenv import load_dotenv

# Load environment variables from root .env file BEFORE importing backend modules
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_file = os.path.join(project_root, '.env')
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    print(f"⚠️  Warning: .env file not found at {env_file}")

# NOW import backend modules after environment is configured
from backend.app import create_app
from backend.app.models import db, API, Email, Round, Log
from sqlalchemy.orm import scoped_session
from datetime import datetime

# Global Flask app instance and context
_app = None
_app_context = None


def init_db() -> None:
    """Initialize Flask app and database connection.

    This should be called once at application startup.
    Uses the backend's create_app() to properly initialize everything.
    """
    global _app, _app_context

    if _app is not None:
        return  # Already initialized

    # Ensure backend is in sys.path for imports
    backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    # Use backend's create_app() which properly loads config and initializes db
    _app = create_app(config_env='development')
    
    # Push app context and keep it active for the lifetime of the script
    _app_context = _app.app_context()
    _app_context.push()
    
    database_url = os.getenv('PROD_DATABASE_URL') or os.getenv('DEV_DATABASE_URL')
    print(f"📦 Connecting to database: {database_url.split('@')[1] if '@' in database_url else '...'}")
    print(f"✅ Database connection initialized")


def get_db():
    """Get the database instance.

    Returns:
        SQLAlchemy database instance
    """
    return db


def save_log(
    level: str,
    message: str,
    round_id: int = None,
    context: dict = None
) -> bool:
    """Persist a log entry to the database logs table.

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
        # Never raise from a logging call to avoid cascading failures
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
    """Log an API call to the database.

    Args:
        round_id: ID of the round this API call belongs to
        agent_type: Type of agent (generator, detector, judge)
        model_name: Name of the model used
        token_used: Total tokens used in the API call
        cost: Cost in USD
        latency_ms: Latency in milliseconds
        email_id: Optional email ID if associated with specific email

    Returns:
        bool: True if successful, False otherwise
    """
    if _app is None:
        print("⚠️  Database not initialized. Call init_db() first.")
        return False

    try:
        # Verify round exists if round_id is provided
        if round_id is not None:
            round_exists = db.session.get(Round, round_id)
            if not round_exists:
                print(f"⚠️  Round {round_id} does not exist. Skipping API call logging.")
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

        # Add and commit
        db.session.add(api_record)
        db.session.commit()

        return True

    except Exception as e:
        msg = f"Failed to log API call to database: {e}"
        print(f"❌ {msg}")
        save_log('error', msg, round_id=round_id)
        db.session.rollback()
        return False

def save_email(
    round_id: int,
    email_result: dict,
    processing_time: float = None
) -> int | None:
    """Save an email to the database.

    Maps the orchestration result JSON to the Email model fields.

    Args:
        round_id: ID of the round this email belongs to
        email_result: Dictionary containing email generation and detection results
        processing_time: Optional processing time in seconds

    Returns:
        int: Email ID if successful, None otherwise
    """
    if _app is None:
        print("⚠️  Database not initialized. Call init_db() first.")
        return None

    try:
        # Extract generator data
        generated_content = email_result.get('generated_content')
        generated_prompt = email_result.get('generated_prompt')
        generated_subject = email_result.get('generated_subject')
        generated_body = email_result.get('generated_body')
        is_phishing = email_result.get('is_phishing', True)  # Default True since we're generating scams
        generated_email_metadata = email_result.get('generated_email_metadata', {})
        generator_latency_ms = email_result.get('generated_latency_ms')

        # Extract detector data
        raw_verdict = email_result.get('detection_verdict', 'unknown')

        # Normalize detector_verdict to 'phishing' or 'legitimate' based on database constraint
        # The detection_verdict from JSON might be a longer summary, but we need the metadata verdict
        metadata_verdict = generated_email_metadata.get('verdict', '').upper() if isinstance(generated_email_metadata, dict) else ''

        # Map various verdict formats to database requirements
        if 'SCAM' in metadata_verdict or 'PHISHING' in metadata_verdict or 'SUSPICIOUS' in metadata_verdict:
            detector_verdict = 'phishing'
        elif 'LEGITIMATE' in metadata_verdict:
            detector_verdict = 'legitimate'
        else:
            # Fallback: analyze the raw verdict string
            raw_verdict_upper = str(raw_verdict).upper()
            if any(word in raw_verdict_upper for word in ['SCAM', 'PHISHING', 'SUSPICIOUS', 'FRAUD', 'MALICIOUS']):
                detector_verdict = 'phishing'
            else:
                detector_verdict = 'legitimate'

        detector_risk_score = email_result.get('detection_risk_score')
        detector_confidence = email_result.get('detection_confidence')
        detector_reasoning = email_result.get('detection_reasoning')
        detector_latency_ms = email_result.get('detector_latency_ms')

        # Ensure detector_confidence is within 0-1 range if provided
        if detector_confidence is not None:
            detector_confidence = max(0.0, min(1.0, float(detector_confidence)))

        # Ensure detector_risk_score is within 0-1 range if provided
        if detector_risk_score is not None:
            detector_risk_score = max(0.0, min(1.0, float(detector_risk_score)))

        # Extract cost
        cost = email_result.get('cost', 0.0)

        # Create Email record
        email_record = Email(
            round_id=round_id,
            generated_content=generated_content,
            generated_prompt=generated_prompt,
            generated_subject=generated_subject,
            generated_body=generated_body,
            is_phishing=is_phishing,
            generated_email_metadata=generated_email_metadata,
            generator_latency_ms=generator_latency_ms,
            detector_verdict=detector_verdict,
            detector_risk_score=detector_risk_score,
            detector_confidence=detector_confidence,
            detector_reasoning=detector_reasoning,
            detector_latency_ms=detector_latency_ms,
            processing_time=processing_time,
            cost=cost,
            created_at=datetime.utcnow()
        )

        # Add and commit
        db.session.add(email_record)
        db.session.commit()

        print(f"✅ Email saved to database with ID: {email_record.id}")
        return email_record.id

    except Exception as e:
        msg = f"Failed to save email to database: {e}"
        print(f"❌ {msg}")
        save_log('error', msg, round_id=round_id)
        db.session.rollback()
        return None


def create_round(
    total_emails: int,
    status: str = 'running',
    created_by: str = None
) -> int | None:
    """Create a new round in the database.

    Args:
        total_emails: Total number of emails to generate in this round
        status: Initial status (default: 'running')
        created_by: Optional username who created this round

    Returns:
        int: Round ID if successful, None otherwise
    """
    if _app is None:
        print("⚠️  Database not initialized. Call init_db() first.")
        return None

    try:
        # Create Round record
        round_record = Round(
            status=status,
            total_emails=total_emails,
            processed_emails=0,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            created_by=created_by
        )

        # Add, flush to get ID, and commit
        db.session.add(round_record)
        db.session.flush()  # Assigns the ID before commit
        db.session.commit()

        print(f"✅ Round created in database with ID: {round_record.id}")
        return round_record.id

    except Exception as e:
        msg = f"Failed to create round in database: {e}"
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
    """Update an existing round in the database.

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
        print("⚠️  Database not initialized. Call init_db() first.")
        return False

    try:
        # Get the round record
        round_record = db.session.get(Round, round_id)
        if not round_record:
            print(f"❌ Round {round_id} not found in database")
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

        # Set completed_at timestamp if status is completed
        if status == 'completed':
            round_record.completed_at = datetime.utcnow()

        # Commit changes
        db.session.commit()

        print(f"✅ Round {round_id} updated in database")
        return True

    except Exception as e:
        msg = f"Failed to update round in database: {e}"
        print(f"❌ {msg}")
        save_log('error', msg, round_id=round_id)
        db.session.rollback()
        return False
