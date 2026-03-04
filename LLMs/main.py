import sys
import asyncio
import os
import json
import logging
from dotenv import load_dotenv

# Load environment variables from root .env file FIRST before anything else
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file = os.path.join(project_root, '.env')
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    print(f"⚠️  Warning: .env file not found at {env_file}")

# Add project root to sys.path for backend imports
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import semantic_kernel as sk
from datetime import datetime, UTC
from semantic_kernel.connectors.ai.open_ai import OpenAIChatCompletion
from backend.app.models import db
from utils.db_utils import init_db, save_email, create_round, update_round, save_log

# Import services (self-contained with their own entities)
from services.orchestration_agent_service import OrchestrationAgentService
from services.generator_agent_service import GeneratorAgentService
from services.detector_agent_service import DetectorAgentService

# Constants
OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_MAX_ROUNDS = 10

def setup_logging():
    """Set up logging to file and console."""
    log_file = "LLM.log"

    # Create logger
    logger = logging.getLogger("LLM_Orchestration")
    logger.setLevel(logging.DEBUG)

    # Remove existing handlers to avoid duplicates
    logger.handlers = []

    # File handler
    file_handler = logging.FileHandler(log_file, mode='a')
    file_handler.setLevel(logging.DEBUG)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

def initialize_kernel():
    """Initialize the Semantic Kernel with OpenAI service."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("⚠️  Please set OPENAI_API_KEY in your .env file")
        print("Example .env file:")
        print("OPENAI_API_KEY=sk-...")
        exit(1)

    print("Initializing Semantic Kernel...")
    kernel = sk.Kernel()

    kernel.add_service(
        OpenAIChatCompletion(
            service_id="openai",
            ai_model_id=OPENAI_MODEL,
            api_key=api_key
        )
    )

    print(f"Kernel initialized with OpenAI service ({OPENAI_MODEL})\n")
    return kernel

# Register services with the kernel
def register_agents(kernel: sk.Kernel) -> None:
    """Register agent services as plugins with the kernel.

    Services are self-contained and create their own entities internally.
    """
    print("🛠️  Initializing services (each creates its own entity)...")

    # Create services - each initializes its own entity
    generator_service = GeneratorAgentService()
    detector_service = DetectorAgentService()
    orchestration_service = OrchestrationAgentService()

    print("   ✓ Services created with internal entities\n")

    print("📦 Registering plugins with Semantic Kernel...")
    # Register all services as plugins (orchestration needs generator + detector)
    kernel.add_plugin(generator_service, "generator")
    kernel.add_plugin(detector_service, "detector")
    kernel.add_plugin(orchestration_service, "orchestration")

    print("✅ All components initialized successfully!")
    print("   - Generator: Service (owned by orchestration) → Kernel")
    print("   - Detector:  Service (owned by orchestration) → Kernel")
    print("   - Orchestration: Service (manages workflow) → Kernel")

async def main():
    """Main orchestration function for multi-round email generation."""
    # Initialize logging
    logger = setup_logging()
    logger.info("=" * 60)
    logger.info("Starting LLM Orchestration Session")
    logger.info("=" * 60)

    # Initialize database connection
    init_db()

    # Initialize kernel and register agents
    kernel = initialize_kernel()
    register_agents(kernel)

    # Get number of rounds from user
    try:
        user_input = input("\nEnter number of rounds: ").strip()
        num_rounds = int(user_input) if user_input else 1
        if num_rounds <= 0:
            print("Invalid input. Using default value of 1.")
            num_rounds = 1
    except ValueError:
        print("Invalid input. Using default value of 1.")
        num_rounds = 1

    # Get number of emails per round from user
    try:
        user_input = input("Enter number of emails per round: ").strip()
        emails_per_round = int(user_input) if user_input else 1
        if emails_per_round <= 0:
            print("Invalid input. Using default value of 1.")
            emails_per_round = 1
    except ValueError:
        print("Invalid input. Using default value of 1.")
        emails_per_round = 1

    logger.info(f"Configuration: {num_rounds} rounds, {emails_per_round} emails per round")

    print("\n" + "="*60)
    print(f"🚀 STARTING AI-POWERED MULTI-ROUND ORCHESTRATION SCAM EMAIL GENERATION")
    print(f"   Rounds: {num_rounds}")
    print(f"   Emails per round: {emails_per_round}")
    print("="*60 + "\n")

    # Get the orchestration service from kernel
    orchestration_service = kernel.get_plugin("orchestration")

    # Store all results across all rounds
    all_rounds_results = []

    # Execute rounds
    for round_num in range(1, num_rounds + 1):
        print("\n" + "="*60)
        print(f"📝 ROUND {round_num}/{num_rounds}")
        print("="*60 + "\n")

        # Create Round record in database
        round_id = create_round(
            total_emails=emails_per_round,
            status='running'
        )
        if not round_id:
            logger.error(f"[Round {round_num}] Failed to create round in database")
            continue

        print(f"✅ Round created with ID: {round_id}\n")

        round_emails = []
        round_start_time = datetime.now(UTC)

        # Generate emails for this round
        for email_num in range(1, emails_per_round + 1):
            print(f"   Generating email {email_num}/{emails_per_round}...")
            logger.info(f"[Round {round_num}] Generating email {email_num}/{emails_per_round}...")

            # Use orchestration agent to generate and analyze in one call
            result = await orchestration_service["ai_orchestrate"].invoke(
                kernel=kernel,
                round_id=round_id
            )

            # The orchestration agent returns properly formatted JSON
            email_result = result.value

            # Log the LLM response
            logger.debug(f"[Round {round_num}, Email {email_num}] Raw LLM Response:")
            logger.debug(json.dumps(email_result, indent=2, default=str))

            # Extract agent statuses from the result (they're at the top level)
            generator_status = email_result.get('generator_agent_status', 0)
            detector_status = email_result.get('detector_agent_status', 0)

            # Add status information to the email result for compatibility
            email_result['generator_agent_return_status'] = generator_status
            email_result['detector_agent_return_status'] = detector_status

            # Save email to database
            email_id = save_email(
                round_id=round_id,
                email_result=email_result,
                processing_time=None  # Will be calculated at round completion
            )
            if email_id:
                email_result['email_id'] = email_id
                logger.info(f"[Round {round_num}, Email {email_num}] Saved to database with ID: {email_id}")
            else:
                msg = f"Failed to save email {email_num} to database"
                logger.warning(f"[Round {round_num}, Email {email_num}] {msg}")
                save_log('warning', msg, round_id=round_id)

            round_emails.append(email_result)
            print(f"   ✓ Email {email_num} generated and analyzed")
            print(f"      Generator status: {'✓' if generator_status == 1 else '✗'}")
            print(f"      Detector status: {'✓' if detector_status == 1 else '✗'}\n")
            logger.info(f"[Round {round_num}, Email {email_num}] Completed - Generator: {generator_status}, Detector: {detector_status}")

        # Store results for this round
        round_result = {
            "round_number": round_num,
            "round_id": round_id,
            "emails": round_emails,
            "total_emails": len(round_emails),
            "generator_agent_return_status": [email.get('generator_agent_return_status', 0) for email in round_emails],
            "detector_agent_return_status": [email.get('detector_agent_return_status', 0) for email in round_emails]
        }
        all_rounds_results.append(round_result)

        # Calculate success counts for this round
        generator_successes = sum(email.get('generator_agent_return_status', 0) for email in round_emails)
        detector_successes = sum(email.get('detector_agent_return_status', 0) for email in round_emails)

        # Update round record in database
        round_end_time = datetime.now(UTC)
        processing_time = int((round_end_time - round_start_time).total_seconds())

        # Calculate total cost for this round from API calls
        total_round_cost = sum(
            float(email.get('generator_agent_api_cost', 0)) + float(email.get('detector_agent_api_cost', 0))
            for email in round_emails
        )

        # Calculate statistics
        detector_accuracy = (detector_successes / len(round_emails) * 100) if round_emails else 0
        generator_success_rate = (generator_successes / len(round_emails) * 100) if round_emails else 0

        # Update round with final statistics
        update_round(
            round_id=round_id,
            status='completed',
            processed_emails=len(round_emails),
            detector_accuracy=detector_accuracy,
            generator_success_rate=generator_success_rate,
            processing_time=processing_time,
            total_cost=total_round_cost
        )

        print(f"\n✅ Round {round_num} complete: {len(round_emails)} emails generated")
        print(f"   Generator successes: {generator_successes}/{len(round_emails)}")
        print(f"   Detector successes: {detector_successes}/{len(round_emails)}")
        print(f"   Processing time: {processing_time}s")
        print(f"   Total cost: ${total_round_cost:.7f}")

        logger.info(f"[Round {round_num}] Summary: {len(round_emails)} emails, Generator: {generator_successes}/{len(round_emails)}, Detector: {detector_successes}/{len(round_emails)}, Time: {processing_time}s, Cost: ${total_round_cost:.7f}")

    # Final summary
    print("\n" + "="*60)
    print("📊 AI ORCHESTRATION COMPLETE")
    print("="*60)
    print(f"\n📊 Summary:")
    print(f"   Total rounds: {num_rounds}")
    print(f"   Emails per round: {emails_per_round}")
    print(f"   Total emails generated: {num_rounds * emails_per_round}")

    logger.info("=" * 60)
    logger.info("AI ORCHESTRATION SESSION COMPLETE")
    logger.info(f"Total rounds: {num_rounds}, Emails per round: {emails_per_round}, Total emails: {num_rounds * emails_per_round}")
    logger.info("=" * 60)

    # Return all results
    final_result = {
        "total_rounds": num_rounds,
        "emails_per_round": emails_per_round,
        "total_emails": num_rounds * emails_per_round,
        "rounds": all_rounds_results
    }

    return final_result

if __name__ == "__main__":
    asyncio.run(main())