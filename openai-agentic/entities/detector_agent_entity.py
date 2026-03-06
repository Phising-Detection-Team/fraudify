import os
from dotenv import load_dotenv
from agents import Agent, ModelSettings
from agents.extensions.models.litellm_model import LitellmModel
from entities.base_entity import BaseEntity
from utils.prompts import get_system_prompt_detector

load_dotenv()

class DetectorAgentEntity(BaseEntity):
    """Entity for Detector Agent - manages state and configuration."""

    def __init__(self):
        super().__init__()
        self.api_key = os.getenv('ANTHROPIC_API_KEY')
        self.tokens_used = 0
        
        system_instructions = get_system_prompt_detector()
        
        # We load the strict formatting requirements into the system prompt here
        full_instructions = system_instructions
        
        self.agent = Agent(
            name="PhishingDetector",
            instructions=full_instructions,
            model=LitellmModel(model="claude-3-5-haiku-20241022", api_key=self.api_key),
            model_settings=ModelSettings(temperature=0.3) # Low temperature for analytical tasks
        )