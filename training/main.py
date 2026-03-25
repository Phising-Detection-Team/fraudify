"""
Entrypoint for the phishing detection fine-tuning pipeline.

Usage:
    python training/main.py                  # full pipeline
    python training/main.py --eval-only      # skip training, evaluate a saved checkpoint
    python training/main.py --no-push        # skip HuggingFace Hub push
"""

import argparse
import os
import sys

# Make training/ importable when running as `python training/main.py` from root
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import config
import data
import model as model_module
import train as train_module
import evaluation as evaluate_module


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phishing detection fine-tuning pipeline")
    parser.add_argument(
        "--eval-only",
        action="store_true",
        help="Skip training and run evaluation on the latest checkpoint.",
    )
    parser.add_argument(
        "--no-push",
        action="store_true",
        help="Skip pushing the model to HuggingFace Hub.",
    )
    parser.add_argument(
        "--tester-size",
        type=int,
        default=250,
        help="Number of test samples for the Tester class (default: 250).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    print("\n" + "=" * 60)
    print("PHISHING DETECTION — FINE-TUNING PIPELINE")
    print("=" * 60)
    print(f"  Base model:  {config.BASE_MODEL}")
    print(f"  Run name:    {config.RUN_NAME}")
    print(f"  Hub target:  {config.HUB_MODEL_NAME or '(not configured)'}")
    print(f"  Mode:        {'eval-only' if args.eval_only else 'train + eval'}")

    # ── Auth ──────────────────────────────────────────────────────────────────
    config.login_huggingface()

    # ── Data ──────────────────────────────────────────────────────────────────
    enron_raw, phishing_raw = data.load_datasets()
    merged = data.preprocess_and_merge(enron_raw, phishing_raw)
    dataset_dict = data.split_dataset(merged)
    tokenized_datasets, tokenizer, data_collator = data.tokenize_datasets(dataset_dict)

    # ── Model ─────────────────────────────────────────────────────────────────
    quant_config = model_module.build_quant_config()
    base_model = model_module.load_model(quant_config)
    peft_model = model_module.apply_lora(base_model)

    # ── Training ──────────────────────────────────────────────────────────────
    trainer = train_module.build_trainer(
        model=peft_model,
        tokenized_datasets=tokenized_datasets,
        tokenizer=tokenizer,
        data_collator=data_collator,
    )

    if not args.eval_only:
        train_module.run_training(trainer)

        if not args.no_push:
            train_module.push_to_hub(trainer, tokenizer)
    else:
        print("\n[--eval-only] Skipping training.")

    # ── Evaluation ────────────────────────────────────────────────────────────
    evaluate_module.run_evaluation(trainer, tokenized_datasets["test"])

    evaluate_module.Tester.test(
        trainer=trainer,
        test_dataset=tokenized_datasets["test"],
        size=args.tester_size,
    )

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
