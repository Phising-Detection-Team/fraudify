import torch
from dotenv import load_dotenv
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer
from entities.base_entity import BaseEntity
from utils.prompts import get_system_prompt_detector

load_dotenv()

class DetectorAgentEntity(BaseEntity):
    """Entity for Detector Agent - manages state and configuration."""

    MODEL_ID = "duyle240820/sentra-utoledo-v1.0"

    def __init__(self):
        super().__init__()
        self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_ID)
        self.model = AutoPeftModelForCausalLM.from_pretrained(
            self.MODEL_ID, torch_dtype="auto", device_map="auto"
        )
        self.model.eval()
        self.system_prompt = get_system_prompt_detector()
