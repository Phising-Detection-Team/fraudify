"""
Generator Agent using OpenAI Agents SDK.

This agent creates phishing or legitimate emails.
"""

from agents import Agent
import random
from ..prompts.generator_prompts import (
    get_phishing_email_prompt,
    get_legitimate_email_prompt,
    get_system_prompt_generator,
    get_generation_prompt
)


def create_generator_agent():
    """
    Create Generator agent with prompts from files.
    
    Returns:
        Agent: Configured generator agent
    """
    
    # Load system prompt from your file
    system_instructions = get_system_prompt_generator()
    
    # choose a generation prompt from the helper and build instructions
    generation_prompt = get_generation_prompt()

    # Add orchestration instructions
    full_instructions = f"""{system_instructions}

{generation_prompt}

WORKFLOW:
1. Randomly decide to generate phishing (50%) or legitimate (50%) email
2. Use appropriate generation strategy
3. Output ONLY valid JSON (no markdown, no extra text)
4. Include all required fields

REQUIRED OUTPUT FORMAT:
{{
    "email_type": "phishing" or "legitimate",
    "subject": "email subject",
    "from": "sender@example.com",
    "body": "email body content",
    "is_phishing": true or false,
    "metadata": {{
        "tactics_used": ["urgency", "authority"],
        "indicators": ["suspicious_link", "generic_greeting"],
        "difficulty": "medium"
    }}
}}
"""
    
    agent = Agent(
        name="EmailGenerator",
        instructions=full_instructions,
        model="gpt-4o-mini",
        temperature=0.8  # Higher for creativity
    )
    
    return agent


def get_generation_prompt():
    """
    Get prompt for email generation.
    
    Randomly chooses phishing or legitimate.
    
    Returns:
        str: Prompt text
    """
    # Randomly choose type
    is_phishing = random.choice([True, False])
    
    if is_phishing:
        return get_phishing_email_prompt()
    else:
        return get_legitimate_email_prompt()