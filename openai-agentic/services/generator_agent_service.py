from agents import Runner
from services.base_service import BaseService
from entities.generator_agent_entity import GeneratorAgentEntity
from utils.prompts import get_generation_prompt

class GeneratorAgentService(BaseService):
    """Service for executing the Generator Entity."""

    def __init__(self):
        super().__init__()
        self.entity = GeneratorAgentEntity()

    async def generate_email(self):
        """Executes the generator agent to create an email."""
        # 1. Get the dynamic generation prompt (randomly phishing or legitimate)
        generation_prompt = get_generation_prompt()

        # 2. Run the agent
        result = await Runner.run(self.entity.agent, generation_prompt, session=None)
        return result