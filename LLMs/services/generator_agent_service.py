import random
from typing import Optional
from semantic_kernel.functions import kernel_function
from services.base_service import BaseService
from entities.generator_agent_entity import GeneratorAgentEntity
from utils.api_utils import (
    track_api_call,
    extract_openai_response,
    extract_openai_tokens
)


class GeneratorAgentService(BaseService):
    """Service for Generator Agent operations.

    This service owns and manages its own GeneratorAgentEntity.
    Configuration is passed to the service constructor.
    """

    def __init__(self, api_key: str = None, model: str = "gpt-4o-mini"):
        """Initialize Generator Agent Service with its own entity.

        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: Model to use (default: gpt-4o-mini)
        """
        super().__init__()
        self.entity = GeneratorAgentEntity(api_key=api_key, model=model)
        self.round_id = None  # Will be set before each generation

    @kernel_function(
        description="Generates a scam email based on a given scenario or random type",
        name="generate_scam"
    )
    async def generate_scam(self, scenario: str = "random") -> dict:
        """Generate a scam email based on the given scenario or a random type.

        Args:
            scenario: Type of scam (phishing, lottery, Nigerian prince, tech support, etc.)
                     Use "random" to generate a random scam type.

        Returns:
            dict: Generated scam email with metadata
        """
        # If scenario is "random", select a random scam type
        if scenario.lower() == "random":
            scam_types = [
                "phishing for bank credentials",
                "lottery winner notification",
                "Nigerian prince inheritance",
                "tech support scam",
                "fake invoice",
                "CEO fraud",
                "romance scam",
                "cryptocurrency investment scam",
                "fake package delivery notification",
                "IRS tax scam",
                "Gift Card award scam",
                "Business email compromise",
                "advance fee scam",
            ]
            scenario = random.choice(scam_types)

        # Load prompt template and format with scenario
        prompt_template = self.entity.get_prompt('generator_generation')
        prompt = prompt_template.format(scenario=scenario)

        # Load system prompt
        system_prompt = self.entity.get_prompt('generator_system')

        # Use self.round_id directly (set by orchestration)
        effective_round_id = self.round_id

        # Define the API call function
        async def make_api_call():
            return await self.entity.client.chat.completions.create(
                model=self.entity.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_completion_tokens=2000
            )

        # Use generalized API tracking utility
        api_result = await track_api_call(
            api_call_func=make_api_call,
            model_name=self.entity.model,
            prompt_content=prompt,
            response_extractor=extract_openai_response,
            token_extractor=extract_openai_tokens,
            agent_type="generator",
            round_id=effective_round_id
        )

        # Format result for generator agent
        if api_result["status"] == 1:
            result = {
                "generator_agent_status": 1,
                "generator_agent_inference_time_seconds": api_result["inference_time_seconds"],
                "generator_agent_api_cost": api_result["api_cost"],
                "generator_agent_token_usage": api_result["token_usage"],
                "generator_agent_prompt": prompt,
                "generator_agent_response": api_result["response"]
            }
            print(f"✅ Generator Agent: SUCCESS (status=1)")
            return result
        else:
            error_result = {
                "generator_agent_status": 0,
                "generator_agent_error": api_result["error"],
                "generator_agent_prompt": prompt
            }
            print(f"❌ Generator Agent: FAILED (status=0) - Error: {api_result['error'][:100]}")
            return error_result