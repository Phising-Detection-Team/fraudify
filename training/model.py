"""
Model setup — Unsloth FastLanguageModel loading and LoRA application.

Exports:
    load_model_and_tokenizer() -> tuple[FastLanguageModel, AutoTokenizer]
    apply_lora()               -> PeftModel
"""

import unsloth
from unsloth import FastLanguageModel

import config


# ─── Model + Tokenizer (Unsloth combined load) ────────────────────────────────

def load_model_and_tokenizer():
    """
    Load Qwen2.5-1.5B-Instruct with Unsloth's FastLanguageModel.

    Unsloth fuses attention kernels, rewrites backward passes with Triton,
    and applies smarter gradient checkpointing — no accuracy change vs stock
    HuggingFace, but 2-5× faster throughput and ~40% less GPU memory.

    BitsAndBytes QLoRA (4-bit NF4) is requested via load_in_4bit=True.
    dtype=None lets Unsloth auto-detect bfloat16 for Qwen2.5.

    Returns:
        (model, tokenizer) — tokenizer already has pad_token and padding_side set.
    """
    print("\n" + "=" * 60)
    print("LOADING MODEL (Unsloth FastLanguageModel)")
    print("=" * 60)
    print(f"Base model:     {config.BASE_MODEL}")
    print(f"Max seq length: {config.MAX_SEQ_LENGTH}")
    print(f"4-bit QLoRA:    {config.QUANT_4_BIT}")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=config.BASE_MODEL,
        max_seq_length=config.MAX_SEQ_LENGTH,
        load_in_4bit=config.QUANT_4_BIT,
        dtype=None,         # auto (bfloat16 for Qwen2.5)
        trust_remote_code=True,
    )

    # Causal LM SFT requires right-padding; pad token must exist
    tokenizer.padding_side = "right"
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    footprint_gb = model.get_memory_footprint() / 1e9
    print(f"Memory footprint: {footprint_gb:.2f} GB")
    print(f"Chat template present: {tokenizer.chat_template is not None}")
    print(f"Vocab size: {tokenizer.vocab_size:,}")

    return model, tokenizer


# ─── LoRA (Unsloth optimized adapters) ───────────────────────────────────────

def apply_lora(model):
    """
    Inject LoRA adapters via Unsloth's FastLanguageModel.get_peft_model().

    Unsloth's LoRA uses hand-written Triton kernels for the adapter forward/
    backward passes, giving ~2× speed improvement over stock PEFT on the
    adapter steps.  use_gradient_checkpointing="unsloth" enables smarter
    activation recomputation (Unsloth's patented scheme) that reduces VRAM
    by a further ~30% without extra wall-clock cost.

    Args:
        model: Unsloth-loaded base model from load_model_and_tokenizer().

    Returns:
        PeftModel with LoRA adapters applied and frozen base weights.
    """
    print("\n" + "=" * 60)
    print("APPLYING LoRA (Unsloth optimized)")
    print("=" * 60)

    peft_model = FastLanguageModel.get_peft_model(
        model,
        r=config.LORA_R,
        lora_alpha=config.LORA_ALPHA,
        lora_dropout=config.LORA_DROPOUT,
        target_modules=config.TARGET_MODULES,
        use_gradient_checkpointing="unsloth",   # smarter than standard checkpointing
        bias="none",
        random_state=42,
    )

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
    print(f"Gradient checkpointing: unsloth")
    print(f"\nTrainable params:    {trainable:,}  ({trainable / total:.2%} of total)")
    print(f"Total params:        {total:,}")

    return peft_model
