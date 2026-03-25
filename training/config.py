"""
Training configuration — the single file to edit when tuning hyperparameters.

All other training modules import constants from here.
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from huggingface_hub import login

load_dotenv()

# ─── Model ────────────────────────────────────────────────────────────────────

BASE_MODEL = "cybersectony/phishing-email-detection-distilbert_v2.4.1"
HF_USER = os.getenv("HF_USER", "")          # your HuggingFace username
PROJECT_NAME = "sentra-utoledo"
RUN_NAME = "v1.0"
PROJECT_RUN_NAME = f"{PROJECT_NAME}-{RUN_NAME}"
HUB_MODEL_NAME = f"{HF_USER}/{PROJECT_RUN_NAME}" if HF_USER else PROJECT_RUN_NAME

# ─── Data ─────────────────────────────────────────────────────────────────────

DATASETS = [
    "SetFit/enron_spam",           # Enron email spam dataset (parquet, 0=ham, 1=spam)
    "ealvaradob/phishing-dataset",  # Phishing URL/email dataset
]
MAX_SEQ_LENGTH = 512

# ─── Quantization ─────────────────────────────────────────────────────────────

# Set QUANT_4_BIT=True for 4-bit NF4 QLoRA, False for 8-bit.
# Note: DistilBERT is only 66M params — quantization has minimal memory benefit
# here but is included for consistency and GPU headroom. Set both to False
# for full precision (float16) training on GPUs with >=4 GB VRAM.
QUANT_4_BIT = True
QUANT_8_BIT = False   # only used when QUANT_4_BIT is False

# ─── LoRA / QLoRA ─────────────────────────────────────────────────────────────

LORA_R = 16                     # rank — higher = more capacity, more params
LORA_ALPHA = 32                 # scaling factor (typically 2 * LORA_R)
LORA_DROPOUT = 0.1
# DistilBERT attention projection layer names (differ from LLaMA's q_proj etc.)
TARGET_MODULES = ["q_lin", "k_lin", "v_lin", "out_lin"]

# ─── Training ─────────────────────────────────────────────────────────────────

EPOCHS = 3
BATCH_SIZE = 16
GRADIENT_ACCUMULATION_STEPS = 1
LEARNING_RATE = 2e-4
LR_SCHEDULER_TYPE = "cosine"
WARMUP_RATIO = 0.03
OPTIMIZER = "paged_adamw_32bit"
WEIGHT_DECAY = 0.01
MAX_GRAD_NORM = 0.3

# ─── Admin ────────────────────────────────────────────────────────────────────

LOGGING_STEPS = 50
SAVE_STEPS = 500
SAVE_TOTAL_LIMIT = 5
OUTPUT_DIR = PROJECT_RUN_NAME   # local checkpoint directory

# ─── Auth helpers ─────────────────────────────────────────────────────────────

def login_huggingface() -> None:
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise EnvironmentError(
            "HF_TOKEN not set. Add it to your .env file or export it in your shell."
        )
    login(token, add_to_git_credential=True)
    print(f"Logged in to HuggingFace as {HF_USER or '(HF_USER not set)'}")
