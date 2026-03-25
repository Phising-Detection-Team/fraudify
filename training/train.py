"""
Training — Trainer setup, training loop, and Hub push.

Exports:
    compute_metrics()  -> dict
    build_trainer()    -> Trainer
    run_training()     -> Trainer
    push_to_hub()      -> None
"""

import numpy as np
import torch
import evaluate
from transformers import (
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)
from datasets import DatasetDict
from peft import PeftModel

import config

# Load metrics once at module level (avoids repeated downloads)
_accuracy_metric = evaluate.load("accuracy")
_f1_metric = evaluate.load("f1")
_precision_metric = evaluate.load("precision")
_recall_metric = evaluate.load("recall")


# ─── Metrics ──────────────────────────────────────────────────────────────────

def compute_metrics(eval_pred) -> dict:
    """
    Compute accuracy, F1 (weighted), precision, and recall.

    Called automatically by Trainer after each evaluation step.
    """
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)

    accuracy  = _accuracy_metric.compute(predictions=predictions, references=labels)
    f1        = _f1_metric.compute(predictions=predictions, references=labels, average="weighted")
    precision = _precision_metric.compute(predictions=predictions, references=labels, average="weighted", zero_division=0)
    recall    = _recall_metric.compute(predictions=predictions, references=labels, average="weighted", zero_division=0)

    return {
        "accuracy":  accuracy["accuracy"],
        "f1":        f1["f1"],
        "precision": precision["precision"],
        "recall":    recall["recall"],
    }


# ─── Trainer setup ────────────────────────────────────────────────────────────

def build_trainer(
    model: PeftModel,
    tokenized_datasets: DatasetDict,
    tokenizer: AutoTokenizer,
    data_collator: DataCollatorWithPadding,
) -> Trainer:
    """
    Configure TrainingArguments and build the HuggingFace Trainer.

    Args:
        model:              LoRA-wrapped PeftModel.
        tokenized_datasets: DatasetDict with "train" and "validation" splits.
        tokenizer:          Tokenizer (needed for hub push).
        data_collator:      DataCollatorWithPadding instance.

    Returns:
        Configured Trainer, ready to call .train() on.
    """
    print("\n" + "=" * 60)
    print("BUILDING TRAINER")
    print("=" * 60)

    use_cuda = torch.cuda.is_available()

    training_args = TrainingArguments(
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
        fp16=True,
        bf16=False,
        logging_steps=config.LOGGING_STEPS,
        eval_strategy="steps",
        eval_steps=config.SAVE_STEPS,
        save_strategy="steps",
        save_steps=config.SAVE_STEPS,
        save_total_limit=config.SAVE_TOTAL_LIMIT,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        report_to="none",
        run_name=config.RUN_NAME,
        push_to_hub=bool(config.HF_USER),
        hub_model_id=config.HUB_MODEL_NAME if config.HF_USER else None,
        hub_strategy="every_save",
        hub_private_repo=True,
        dataloader_pin_memory=use_cuda,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["validation"],
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    print(f"Training samples:   {len(tokenized_datasets['train']):,}")
    print(f"Validation samples: {len(tokenized_datasets['validation']):,}")
    print(f"Epochs:             {config.EPOCHS}")
    print(f"Batch size:         {config.BATCH_SIZE}  (grad accum: {config.GRADIENT_ACCUMULATION_STEPS})")
    print(f"Effective batch:    {config.BATCH_SIZE * config.GRADIENT_ACCUMULATION_STEPS}")
    print(f"Learning rate:      {config.LEARNING_RATE}")
    print(f"Optimizer:          {config.OPTIMIZER}")
    print(f"Output dir:         {config.OUTPUT_DIR}")

    return trainer


# ─── Training loop ────────────────────────────────────────────────────────────

def run_training(trainer: Trainer) -> Trainer:
    """
    Run trainer.train().

    Args:
        trainer: Configured Trainer instance.

    Returns:
        The same Trainer (now with training state populated).
    """
    print("\n" + "=" * 60)
    print("TRAINING")
    print("=" * 60)

    trainer.train()

    print("\nTraining complete.")
    return trainer


# ─── Hub push ─────────────────────────────────────────────────────────────────

def push_to_hub(trainer: Trainer, tokenizer: AutoTokenizer) -> None:
    """
    Push the fine-tuned model and tokenizer to HuggingFace Hub.

    Args:
        trainer:   Trained Trainer instance.
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
