from agents import Runner
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.prompts import get_detection_prompt, get_system_prompt_detector
import sys

class DetectorAgentService(BaseService):
    """Service for executing the Detector Entity."""

    def __init__(self):
        super().__init__()
        self.entity = DetectorAgentEntity()

    async def analyze_email(self, email_content: str):
        """Executes the detector agent on a generated email."""
        try:
            # Get system prompt + analysis prompt
            system_prompt = get_system_prompt_detector()
            analysis_prompt = get_detection_prompt(email_content)
            
            # Combine system instructions with the detection prompt
            full_prompt = f"{system_prompt}\n\n{analysis_prompt}"
            
            print(f"[Detector] Calling Claude with prompt length: {len(full_prompt)} chars", file=sys.stderr)
            
            # Run the agent with combined prompt
            result = await Runner.run(self.entity.agent, full_prompt, session=None)
            
            print(f"[Detector] Claude response received, output length: {len(result.final_output) if hasattr(result, 'final_output') else 'N/A'}", file=sys.stderr)
            
            return result
            
        except Exception as e:
            print(f"[Detector] ERROR calling Claude: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            raise