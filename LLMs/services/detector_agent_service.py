from semantic_kernel.functions import kernel_function
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.api_utils import (
    track_api_call,
    extract_anthropic_response,
    extract_anthropic_tokens
)


class DetectorAgentService(BaseService):
    """Service for Detector Agent operations.

    This service owns and manages its own DetectorAgentEntity.
    Configuration is passed to the service constructor.
    """

    def __init__(self, api_key: str = None, model: str = "claude-3-haiku-20240307"):
        """Initialize Detector Agent Service with its own entity.

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            model: Model to use (default: claude-3-haiku-20240307)
        """
        super().__init__()
        self.entity = DetectorAgentEntity(api_key=api_key, model=model)
        self.round_id = None  # Will be set before each detection

    @kernel_function(
        description="Analyzes an email to detect if it's a scam with detailed indicator scoring and reasoning",
        name="detect_scam"
    )
    async def detect_scam(self, email_content: str = "") -> dict:
        """Analyze an email to determine if it's a scam with comprehensive indicator analysis.

        Args:
            email_content: The email content to analyze

        Returns:
            dict: Detailed analysis with verdict, confidence, indicator scores, and reasoning
        """

        # Ensure email_content is a string
        if not isinstance(email_content, str):
            email_content = str(email_content) if email_content else ""

        # Load prompt template and format with email content
        prompt_template = self.entity.get_prompt('detector_analysis')
        prompt = prompt_template.format(email_content=email_content)

        # Load system prompt
        system_prompt = self.entity.get_prompt('detector_system')

        # Prepare messages payload
        messages_payload = [{"role": "user", "content": prompt}]

        # Use self.round_id directly (set by orchestration)
        effective_round_id = self.round_id

        # Define the API call function
        async def make_api_call():
            return await self.entity.client.messages.create(
                model=self.entity.model,
                max_tokens=2000,
                temperature=0.6,
                system=system_prompt,
                messages=messages_payload
            )

        # Use generalized API tracking utility
        api_result = await track_api_call(
            api_call_func=make_api_call,
            model_name=self.entity.model,
            prompt_content=messages_payload,
            response_extractor=extract_anthropic_response,
            token_extractor=extract_anthropic_tokens,
            agent_type="detector",
            round_id=effective_round_id
        )

        # Format result for detector agent
        if api_result["status"] == 1:
            result = {
                "detector_agent_status": 1,
                "detector_agent_inference_time_seconds": api_result["inference_time_seconds"],
                "detector_agent_api_cost": api_result["api_cost"],
                "detector_agent_token_usage": api_result["token_usage"],
                "detector_agent_response": api_result["response"]
            }
            print(f"✅ Detector Agent: SUCCESS (status=1)")
            return result
        else:
            error_result = {
                "detector_agent_status": 0,
                "detector_agent_error": api_result["error"]
            }
            print(f"❌ Detector Agent: FAILED (status=0) - Error: {api_result['error'][:100]}")
            return error_result
