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
        # 2. Add the dynamic instructions and constraints
        full_prompt = f"""{generation_prompt}

CRITICAL: You are using the OpenAI Agents SDK framework.

WORKFLOW:
1. Decide randomly: phishing (50%) or legitimate (50%) email
2. Follow the specific instructions and constraints for the chosen email type
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
                "data breach notification",
                "account suspension notice",
                "fake charity request",
                "social media impersonation",
                "fake job offer",
                "travel scam",
                "fake subscription renewal",
                "fake event invitation",
                "RULE: update more if needed"
            ]
3. Apply appropriate tactics from the prompt above
4. Generate email with realistic details (NO placeholders!)
5. Output ONLY valid JSON (no markdown, no code blocks, no explanations)

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
        
        # 3. Run the agent
        result = await Runner.run(self.entity.agent, full_prompt, session=None)
        return result