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
        full_instructions = f"""{system_instructions}

CRITICAL: You are using the OpenAI Agents SDK framework.

WORKFLOW:
1. Receive email content to analyze
2. Apply multi-layer analysis framework (11 indicators)
3. Calculate scores for each indicator (0-10)
4. Determine overall scam score and confidence
5. Output ONLY valid JSON (no markdown, no code blocks, no explanations)

REQUIRED JSON OUTPUT FORMAT:
{{
    "verdict": "SCAM" | "LIKELY SCAM" | "SUSPICIOUS" | "LIKELY LEGITIMATE" | "LEGITIMATE",
    "confidence": 0.0 to 1.0,
    "scam_score": 0.0 to 1.0,
    "reasoning": "Brief 2-3 sentence summary of key findings",
    "indicators": [
        {{
            "category": "Urgency & Pressure",
            "score": 0.0 to 1.0,
            "evidence": "Specific evidence from email"
        }}
    ],
    "red_flags": ["Most critical indicator 1", "Most critical indicator 2"],
    "legitimacy_markers": ["Legitimate aspect 1 if any"],
    "sophistication": "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH",
    "threat_level": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL",
    "recommended_action": "BLOCK" | "WARN" | "REVIEW" | "ALLOW"
}}

ANALYSIS GUIDELINES:
- Be thorough but concise
- Provide specific evidence, not generic statements
- Consider sophistication level (advanced scams have good grammar)
- Score each of 11 indicators (0-10 scale)
- Calculate overall scam score as weighted average
- Be confident in verdict but acknowledge uncertainty when present
- Output ONLY the JSON object, nothing else
"""
        
        self.agent = Agent(
            name="PhishingDetector",
            instructions=full_instructions,
            model=LitellmModel(model="claude-3-5-haiku-20241022", api_key=self.api_key),
            model_settings=ModelSettings(temperature=0.3) # Low temperature for analytical tasks
        )