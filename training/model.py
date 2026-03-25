"""
Model setup — quantization config, model loading, and LoRA application.

Exports:
    build_quant_config()  -> BitsAndBytesConfig | None
    load_model()          -> AutoModelForSequenceClassification
    apply_lora()          -> PeftModel
"""

import torch
from torch import nn
from transformers import AutoConfig, AutoModelForSequenceClassification, BitsAndBytesConfig
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training

import config

ID2LABEL = {0: "legitimate", 1: "phishing"}
LABEL2ID = {"legitimate": 0, "phishing": 1}
NUM_LABELS = len(ID2LABEL)


# ─── Quantization ─────────────────────────────────────────────────────────────

def build_quant_config() -> BitsAndBytesConfig | None:
    """
    Build a BitsAndBytesConfig based on config flags.

    Returns None if both QUANT_4_BIT and QUANT_8_BIT are False
    (i.e. full precision / float16 training).
    """
    if config.QUANT_4_BIT:
        print("Quantization: 4-bit NF4 (QLoRA)")
        return BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_quant_type="nf4",
            llm_int8_skip_modules=["classifier", "pre_classifier"],
        )
    if config.QUANT_8_BIT:
        print("Quantization: 8-bit")
        return BitsAndBytesConfig(
            load_in_8bit=True,
            bnb_8bit_compute_dtype=torch.bfloat16,
            llm_int8_skip_modules=["classifier", "pre_classifier"],
        )
    print("Quantization: none (full precision)")
    return None


# ─── Model loading ────────────────────────────────────────────────────────────

def load_model(
    quant_config: BitsAndBytesConfig | None,
) -> AutoModelForSequenceClassification:
    """
    Load the base model with quantization and classification head.

    Args:
        quant_config: BitsAndBytesConfig or None for full precision.

    Returns:
        AutoModelForSequenceClassification ready for LoRA wrapping.
    """
    print("\n" + "=" * 60)
    print("LOADING MODEL")
    print("=" * 60)
    print(f"Base model: {config.BASE_MODEL}")

    model_config = AutoConfig.from_pretrained(
        config.BASE_MODEL,
        trust_remote_code=True,
        num_labels=NUM_LABELS,
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        problem_type="single_label_classification",
    )

    kwargs = dict(
        config=model_config,
        ignore_mismatched_sizes=True,  # allows loading pre-trained weights into new classification head
    )

    if quant_config is not None:
        kwargs["quantization_config"] = quant_config
        kwargs["device_map"] = "auto"
    else:
        kwargs["torch_dtype"] = torch.float16
        kwargs["device_map"] = "auto"

    model = AutoModelForSequenceClassification.from_pretrained(
        config.BASE_MODEL,
        **kwargs,
    )

    _ensure_binary_classification_head(model)

    footprint_gb = model.get_memory_footprint() / 1e9
    print(f"Memory footprint: {footprint_gb:.2f} GB")
    print(f"Labels: {ID2LABEL}")

    return model


def _ensure_binary_classification_head(model: AutoModelForSequenceClassification) -> None:
    """
    Ensure the loaded classifier head matches the binary label space.

    Some checkpoints carry a stale config/classifier shape from a previous
    fine-tune. Rebuilding the head avoids batch-size mismatches inside the loss.
    """
    classifier = getattr(model, "classifier", None)
    out_features = getattr(classifier, "out_features", None)
    weight = getattr(classifier, "weight", None)
    current_rows = weight.shape[0] if weight is not None else out_features
    in_features = getattr(classifier, "in_features", None)

    if current_rows != NUM_LABELS:
        if in_features is None:
            raise ValueError("Unsupported classifier head: cannot determine input dimension.")

        replacement = nn.Linear(in_features, NUM_LABELS)
        if weight is not None:
            replacement = replacement.to(device=weight.device, dtype=weight.dtype)
        model.classifier = replacement
        print(f"Reset classifier head from {current_rows} outputs to {NUM_LABELS}.")

    model.num_labels = NUM_LABELS
    model.config.num_labels = NUM_LABELS
    model.config.id2label = ID2LABEL
    model.config.label2id = LABEL2ID
    model.config.problem_type = "single_label_classification"


# ─── LoRA ─────────────────────────────────────────────────────────────────────

def apply_lora(model: AutoModelForSequenceClassification):
    """
    Wrap the base model with LoRA adapters for sequence classification.

    LoRA injects trainable low-rank matrices into the target attention
    projection layers. All other weights are frozen.

    Args:
        model: The loaded base model.

    Returns:
        PeftModel with LoRA adapters applied and frozen base weights.
    """
    print("\n" + "=" * 60)
    print("APPLYING LoRA")
    print("=" * 60)

    # Cast non-quantized layers (classifier head, LayerNorm) to float32
    # so they can accept gradients when using 4-bit / 8-bit quantization.
    if config.QUANT_4_BIT or config.QUANT_8_BIT:
        model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        task_type=TaskType.SEQ_CLS,
        r=config.LORA_R,
        lora_alpha=config.LORA_ALPHA,
        lora_dropout=config.LORA_DROPOUT,
        target_modules=config.TARGET_MODULES,
        bias="none",
    )

    peft_model = get_peft_model(model, lora_config)

    # Print trainable vs total param breakdown
    trainable, total = 0, 0
    for _, p in peft_model.named_parameters():
        total += p.numel()
        if p.requires_grad:
            trainable += p.numel()

    print(f"LoRA rank (r):       {config.LORA_R}")
    print(f"LoRA alpha:          {config.LORA_ALPHA}")
    print(f"LoRA dropout:        {config.LORA_DROPOUT}")
    print(f"Target modules:      {config.TARGET_MODULES}")
    print(f"\nTrainable params:    {trainable:,}  ({trainable / total:.2%} of total)")
    print(f"Total params:        {total:,}")

    return peft_model
