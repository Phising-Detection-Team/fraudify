"""
Generator Agent using OpenAI Agents SDK.

This agent creates realistic phishing or legitimate emails using Gemini 2.0 Flash.
The agent uses sophisticated social engineering tactics to create convincing emails.

Key Components:
    - Model: Gemini 2.0 Flash (Google)
    - Purpose: Generate phishing/legitimate emails
    - Output: JSON with email content and metadata
    
Why Gemini for Generator:
    - Fast and cost-effective ($0.075/$0.30 per 1M tokens)
    - Excellent at creative content generation
    - Good at following complex prompts
    - Supports long outputs (emails with metadata)
"""

from agents import Agent
import random
from .prompts import (
    get_phishing_email_prompt,
    get_legitimate_email_prompt,
    get_system_prompt_generator
)


def create_generator_agent():
    """
    Create Generator agent with Gemini 2.0 Flash model.
    
    This agent randomly generates either phishing or legitimate emails
    with sophisticated social engineering tactics.
    
    Returns:
        Agent: Configured generator agent with Gemini model
    
    Model Details:
        - Provider: Google
        - Model: gemini-2.0-flash-exp
        - Temperature: 0.8 (high for creativity)
        - Purpose: Creative email generation
    
    Example:
        >>> generator = create_generator_agent()
        >>> # Agent will randomly create phishing or legitimate email
    """
    
    # Load system prompt from centralized prompts file
    system_instructions = get_system_prompt_generator()
    
    # Get a random generation prompt (phishing or legitimate)
    generation_prompt = get_generation_prompt()
    
    # Combine system instructions with generation prompt
    full_instructions = f"""{system_instructions}

{generation_prompt}

CRITICAL: You are using the OpenAI Agents SDK framework.

WORKFLOW:
1. Decide randomly: phishing (50%) or legitimate (50%) email
2. Apply appropriate tactics from the prompt above
3. Generate email with realistic details (NO placeholders!)
4. Output ONLY valid JSON (no markdown, no code blocks, no explanations)

REQUIRED JSON OUTPUT FORMAT:
{{
    "email_type": "phishing" or "legitimate",
    "subject": "realistic email subject",
    "from": "realistic_sender@company.com",
    "body": "full email body with realistic details",
    "is_phishing": true or false,
    "metadata": {{
        "tactics_used": ["urgency", "authority", "fear"],
        "indicators": ["suspicious_link", "generic_greeting"],
        "difficulty": "low" | "medium" | "high",
        "scenario": "brief description of scenario"
    }}
}}

IMPORTANT RULES:
- NO placeholders like [NAME], [COMPANY], [AMOUNT]
- Fill in ALL specific details with realistic values
- Use real company names, addresses, phone numbers
- Make phishing emails sophisticated enough to require analysis
- Make legitimate emails completely safe and professional
- Output ONLY the JSON object, nothing else
"""
    
    # Create agent with Gemini model
    agent = Agent(
        name="EmailGenerator",
        instructions=full_instructions,
        model="gemini-2.0-flash-exp",  # Use Gemini for generation
        temperature=0.8  # Higher temperature for creative, varied outputs
    )
    
    return agent


def get_generation_prompt():
    """
    Get random generation prompt (phishing or legitimate).
    
    This function randomly chooses between phishing and legitimate
    email generation to create balanced training data.
    
    Returns:
        str: Formatted prompt for either phishing or legitimate email
    
    Probability:
        - 50% phishing
        - 50% legitimate
    
    Example:
        >>> prompt = get_generation_prompt()
        >>> # Returns either phishing or legitimate prompt randomly
    """
    # Randomly choose email type
    is_phishing = random.choice([True, False])
    
    if is_phishing:
        # Generate phishing email with social engineering tactics
        return get_phishing_email_prompt(scenario="phishing")
    else:
        # Generate normal legitimate email
        return get_legitimate_email_prompt(scenario="legitimate")