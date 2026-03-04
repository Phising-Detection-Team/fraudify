from agents import Runner
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.prompts import get_detection_prompt

class DetectorAgentService(BaseService):
    """Service for executing the Detector Entity."""

    def __init__(self):
        super().__init__()
        self.entity = DetectorAgentEntity()

    async def analyze_email(self, email_content: str):
        """Executes the detector agent on a generated email."""
        det_prompt = get_detection_prompt(email_content)
        result = await Runner.run(self.entity.agent, det_prompt, session=None)
        return result