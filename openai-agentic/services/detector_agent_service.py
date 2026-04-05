import types
import torch
from services.base_service import BaseService
from entities.detector_agent_entity import DetectorAgentEntity
from utils.prompts import get_detection_prompt

class DetectorAgentService(BaseService):
    """Service for executing the Detector Entity."""

    def __init__(self):
        super().__init__()
        self.entity = DetectorAgentEntity()

    async def analyze_email(self, email_content: str):
        """Runs local phishing detection model on an email."""
        det_prompt = get_detection_prompt(email_content)

        messages = [
            {"role": "system", "content": self.entity.system_prompt},
            {"role": "user", "content": det_prompt},
        ]

        tokenizer = self.entity.tokenizer
        model = self.entity.model

        if hasattr(tokenizer, "apply_chat_template"):
            input_text = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
        else:
            input_text = f"{self.entity.system_prompt}\n\n{det_prompt}"

        device = next(model.parameters()).device
        inputs = tokenizer(input_text, return_tensors="pt").to(device)

        pad_token_id = (
            tokenizer.pad_token_id
            if tokenizer.pad_token_id is not None
            else tokenizer.eos_token_id
        )

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.3,
                do_sample=True,
                pad_token_id=pad_token_id,
            )

        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        output_text = tokenizer.decode(new_tokens, skip_special_tokens=True)

        return types.SimpleNamespace(final_output=output_text)
