import os
import sys
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
        
        if not self.api_key:
            print("[Detector] WARNING: ANTHROPIC_API_KEY not found in environment!", file=sys.stderr)
        else:
            print(f"[Detector] API key loaded (length: {len(self.api_key)})", file=sys.stderr)
        
        self.tokens_used = 0
        
        system_instructions = get_system_prompt_detector()
        print(f"[Detector] System instructions loaded (length: {len(system_instructions)})", file=sys.stderr)
        
        try:
            self.agent = Agent(
                name="PhishingDetector",
                instructions=system_instructions,
                model=LitellmModel(model="anthropic/claude-3-haiku-20240307", api_key=self.api_key),
                model_settings=ModelSettings(temperature=0.2)
            )
            print("[Detector] Agent initialized successfully", file=sys.stderr)
        except Exception as e:
            print(f"[Detector] ERROR initializing agent: {e}", file=sys.stderr)
            raise