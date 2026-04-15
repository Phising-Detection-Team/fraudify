"""
Training — SFTTrainer setup, training loop, and Hub push.

Exports:
    build_trainer()  -> SFTTrainer
    run_training()   -> SFTTrainer
    push_to_hub()    -> None
"""

import torch
from transformers import AutoTokenizer
from datasets import DatasetDict
from peft import PeftModel
from trl import SFTTrainer, SFTConfig

import config


# ─── Trainer setup ────────────────────────────────────────────────────────────

def build_trainer(
    model: PeftModel,
    formatted_datasets: DatasetDict,
    tokenizer: AutoTokenizer,
) -> SFTTrainer:
    """
    Configure SFTConfig and build the TRL SFTTrainer.

    SFTTrainer handles causal LM language modeling loss (cross-entropy on
    all tokens in the 'text' column produced by apply_chat_template).
    Evaluation during training uses eval_loss as the checkpoint metric.

    Args:
        model:              LoRA-wrapped PeftModel.
        formatted_datasets: DatasetDict with "train" and "validation" splits,
                            each containing a "text" column (chat-formatted string).
        tokenizer:          Qwen AutoTokenizer.

    Returns:
        Configured SFTTrainer, ready to call .train() on.
    """
    print("\n" + "=" * 60)
    print("BUILDING TRAINER")
    print("=" * 60)

    use_cuda  = torch.cuda.is_available()
    use_bf16  = use_cuda and torch.cuda.is_bf16_supported()
    use_fp16  = use_cuda and not use_bf16
    print(f"Device: {'CUDA (bf16)' if use_bf16 else 'CUDA (fp16)' if use_fp16 else 'CPU (fp32)'}")

    sft_config = SFTConfig(
        output_dir=config.OUTPUT_DIR,
        num_train_epochs=config.EPOCHS,
        per_device_train_batch_size=config.BATCH_SIZE,
        per_device_eval_batch_size=config.BATCH_SIZE,
        gradient_accumulation_steps=config.GRADIENT_ACCUMULATION_STEPS,
        optim=config.OPTIMIZER,
        learning_rate=config.LEARNING_RATE,
        weight_decay=config.WEIGHT_DECAY,
        lr_scheduler_type=config.LR_SCHEDULER_TYPE,
        warmup_ratio=config.WARMUP_RATIO,
        max_grad_norm=config.MAX_GRAD_NORM,
        fp16=use_fp16,
        bf16=use_bf16,        # bfloat16 on Ampere+ GPUs; falls back to fp16 on older hardware
        logging_steps=config.LOGGING_STEPS,
        eval_strategy="steps",
        eval_steps=config.SAVE_STEPS,
        save_strategy="steps",
        save_steps=config.SAVE_STEPS,
        save_total_limit=config.SAVE_TOTAL_LIMIT,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",
        run_name=config.RUN_NAME,
        push_to_hub=bool(config.HF_USER),
        hub_model_id=config.HUB_MODEL_NAME if config.HF_USER else None,
        hub_strategy="every_save",
        hub_private_repo=True,
        dataloader_pin_memory=use_cuda,
        # SFT-specific
        max_length=config.MAX_SEQ_LENGTH,
        dataset_text_field="text",
        packing=True,   # Unsloth sequence packing — 30-50% extra throughput
    )

    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=formatted_datasets["train"],
        eval_dataset=formatted_datasets["validation"],
        processing_class=tokenizer,
    )

    print(f"Training samples:   {len(formatted_datasets['train']):,}")
    print(f"Validation samples: {len(formatted_datasets['validation']):,}")
    print(f"Epochs:             {config.EPOCHS}")
    print(f"Batch size:         {config.BATCH_SIZE}  (grad accum: {config.GRADIENT_ACCUMULATION_STEPS})")
    print(f"Effective batch:    {config.BATCH_SIZE * config.GRADIENT_ACCUMULATION_STEPS}")
    print(f"Learning rate:      {config.LEARNING_RATE}")
    print(f"Optimizer:          {config.OPTIMIZER}")
    print(f"Max seq length:     {config.MAX_SEQ_LENGTH}")
    print(f"Output dir:         {config.OUTPUT_DIR}")

    return trainer


# ─── Training loop ────────────────────────────────────────────────────────────

def run_training(trainer: SFTTrainer) -> SFTTrainer:
    """
    Run trainer.train().

    Args:
        trainer: Configured SFTTrainer instance.

    Returns:
        The same SFTTrainer (now with training state populated).
    """
    print("\n" + "=" * 60)
    print("TRAINING")
    print("=" * 60)

    trainer.train()

    print("\nTraining complete.")
    return trainer


# ─── Hub push ─────────────────────────────────────────────────────────────────

def push_to_hub(trainer: SFTTrainer, tokenizer: AutoTokenizer) -> None:
    """
    Push the fine-tuned model and tokenizer to HuggingFace Hub.

    Args:
        trainer:   Trained SFTTrainer instance.
        tokenizer: Tokenizer to push alongside the model.
    """
    if not config.HF_USER:
        print("HF_USER not set in config — skipping Hub push.")
        return

    print("\n" + "=" * 60)
    print("PUSHING TO HUB")
    print("=" * 60)
    print(f"Destination: {config.HUB_MODEL_NAME}")

    trainer.model.push_to_hub(config.HUB_MODEL_NAME, private=True)
    tokenizer.push_to_hub(config.HUB_MODEL_NAME, private=True)

    print(f"Model pushed to: https://huggingface.co/{config.HUB_MODEL_NAME}")
