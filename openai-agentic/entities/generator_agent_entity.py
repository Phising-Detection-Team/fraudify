import os
from dotenv import load_dotenv
from agents import Agent, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel
from entities.base_entity import BaseEntity
from utils.prompts import get_system_prompt_generator

load_dotenv()

class GeneratorAgentEntity(BaseEntity):
    """Entity for Generator Agent - manages state and configuration."""

    def __init__(self):
        super().__init__()
        self.api_key = os.getenv('GOOGLE_API_KEY')
        self.tokens_used = 0
        
        # Load static system instructions
        system_instructions = get_system_prompt_generator()
        
        # Define the agent with its static configuration
        # Use 'gemini/' prefix so LiteLLM routes to Google AI Studio (API key)
        # instead of Vertex AI (which requires Google Cloud ADC credentials)
        self.agent = Agent(
            name="EmailGenerator",
            instructions=system_instructions,
            model=LitellmModel(model="gemini/gemini-2.0-flash", api_key=self.api_key),
            model_settings=ModelSettings(temperature=0.8) # Higher temperature for creative outputs
        )