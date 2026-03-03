"""
Detector Agent using OpenAI Agents SDK.

This agent analyzes emails for phishing indicators using Claude 3.5 Haiku.
It performs comprehensive multi-layer analysis to detect sophisticated scams.

Key Components:
    - Model: Claude 3.5 Haiku (Anthropic)
    - Purpose: Detect phishing emails
    - Output: JSON with verdict, confidence, and detailed reasoning
    
Why Claude for Detector:
    - Excellent at analytical reasoning ($0.25/$1.25 per 1M tokens)
    - Strong security/safety analysis capabilities
    - Good at structured output (JSON)
    - Consistent, reliable verdicts
"""

from agents import Agent
from .prompts import (
    get_detection_prompt,
    get_system_prompt_detector
)


def create_detector_agent():
    """
    Create Detector agent with Claude 3.5 Haiku model.
    
    This agent performs sophisticated multi-layer analysis to detect
    phishing emails using 11 different analytical frameworks.
    
    Returns:
        Agent: Configured detector agent with Claude model
    
    Model Details:
        - Provider: Anthropic
        - Model: claude-3-5-haiku-20241022
        - Temperature: 0.3 (low for consistent analysis)
        - Purpose: Security analysis and threat detection
    
    Analysis Layers:
        1. Structural Analysis (sender, language, formatting)
        2. Content Analysis (urgency, info requests, financial indicators)
        3. Psychological Analysis (emotional manipulation, social engineering)
        4. Technical Analysis (links, URLs, contextual anomalies)
    
    Example:
        >>> detector = create_detector_agent()
        >>> # Agent will analyze email and provide detailed verdict
    """
    
    # Load system prompt from centralized prompts file
    system_instructions = get_system_prompt_detector()
    
    # Add orchestration-specific instructions
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
    "confidence": 0.0 to 1.0 (decimal, e.g., 0.92 for 92%),
    "scam_score": 0.0 to 1.0 (decimal, e.g., 0.85 for 85/100),
    "reasoning": "Brief 2-3 sentence summary of key findings",
    "indicators": [
        {{
            "category": "Urgency & Pressure",
            "score": 0.0 to 1.0,
            "evidence": "Specific evidence from email"
        }},
        {{
            "category": "Sender Authenticity",
            "score": 0.0 to 1.0,
            "evidence": "Specific evidence from email"
        }}
        // ... include all 11 indicators
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
    
    # Create agent with Claude model
    agent = Agent(
        name="PhishingDetector",
        instructions=full_instructions,
        model="claude-3-5-haiku-20241022",  # Use Claude for detection
        temperature=0.3  # Lower temperature for consistent, analytical responses
    )
    
    return agent


def get_detection_prompt_for_email(email_content: str) -> str:
    """
    Get detection analysis prompt for specific email.
    
    This wraps the email content in the comprehensive analysis framework
    that guides Claude through the 11-layer detection process.
    
    Args:
        email_content: The email text to analyze (with Subject and Body)
    
    Returns:
        str: Formatted prompt with email content and analysis instructions
    
    The prompt includes:
        - Email content to analyze
        - 11-layer analysis framework
        - Scoring guidelines (0-10 for each indicator)
        - Output format requirements
    
    Example:
        >>> email = "Subject: URGENT!\\nFrom: admin@bank.com\\n\\nYour account..."
        >>> prompt = get_detection_prompt_for_email(email)
        >>> # Returns full analysis prompt with email embedded
    """
    return get_detection_prompt(email_content)