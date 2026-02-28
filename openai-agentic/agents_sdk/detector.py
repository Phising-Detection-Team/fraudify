"""
Detector Agent using OpenAI Agents SDK.

This agent analyzes emails for phishing.
"""

from agents import Agent
from ..prompts.detector_prompts import (
    get_detection_prompt,
    get_system_prompt_detector
)


def create_detector_agent():
    """
    Create Detector agent with prompts from files.
    
    Returns:
        Agent: Configured detector agent
    """
    
    # Load system prompt from your file
    system_instructions = get_system_prompt_detector()
    
    # Add orchestration instructions with analysis framework
    full_instructions = f"""{system_instructions}

ANALYSIS APPROACH:
You will receive an email to analyze. Use the comprehensive detection prompt to:
1. Examine structural, content, psychological, and technical layers
2. Identify phishing indicators with evidence
3. Calculate confidence score (0.0 to 1.0)
4. Provide clear verdict: phishing or legitimate
5. Output ONLY valid JSON (no markdown, no extra text)

REQUIRED OUTPUT FORMAT:
{{
    "verdict": "phishing" or "legitimate",
    "confidence": 0.0 to 1.0,
    "reasoning": "Brief explanation (2-3 sentences)",
    "indicators": ["list", "of", "indicators", "found"],
    "severity": "low" or "medium" or "high"
}}
"""
    
    agent = Agent(
        name="PhishingDetector",
        instructions=full_instructions,
        model="gpt-4o-mini",
        temperature=0.3  # Lower for consistency
    )
    
    return agent


def get_detection_prompt_for_email(email_content: str) -> str:
    """
    Get detection prompt for specific email.
    
    Uses your existing prompt template.
    
    Args:
        email_content: Email to analyze
    
    Returns:
        str: Formatted prompt
    """
    return get_detection_prompt(email_content)