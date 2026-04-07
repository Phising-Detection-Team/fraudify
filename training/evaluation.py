"""
Evaluation — generate-based verdict accuracy, per-sample Tester class,
and confusion matrix.

Exports:
    run_evaluation()        -> dict
    Tester                  (class)
    plot_confusion_matrix() -> None
"""

import json
import re
import math
import torch
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
from transformers import AutoTokenizer
from datasets import Dataset

import config
import data as data_module

# Terminal colour codes
GREEN  = "\033[92m"
RED    = "\033[91m"
RESET  = "\033[0m"


# ─── JSON verdict parsing ─────────────────────────────────────────────────────

def _parse_verdict(output_text: str) -> str | None:
    """
    Extract verdict from model-generated text.

    Tries JSON parsing first; falls back to keyword search.

    Returns:
        "SCAM", "LEGITIMATE", or None on parse failure.
    """
    try:
        json_match = re.search(r'\{[^{}]*"verdict"[^{}]*\}', output_text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            verdict = str(parsed.get("verdict", "")).upper().strip()
            if verdict in ("SCAM", "LEGITIMATE"):
                return verdict
    except (json.JSONDecodeError, AttributeError, ValueError):
        pass

    # Fallback: keyword search
    upper = output_text.upper()
    if "SCAM" in upper:
        return "SCAM"
    if "LEGITIMATE" in upper:
        return "LEGITIMATE"
    return None


def _verdict_to_label(verdict: str | None) -> int:
    return 1 if verdict == "SCAM" else 0


# ─── Full test-set evaluation ─────────────────────────────────────────────────

def run_evaluation(trainer, test_dataset: Dataset) -> dict:
    """
    Run trainer.evaluate() on the held-out test set and print a metrics table.

    This measures eval_loss (LM cross-entropy) — the training checkpoint metric.
    Use Tester for human-readable verdict accuracy.

    Args:
        trainer:      Trained SFTTrainer instance.
        test_dataset: Formatted test Dataset with "text" column.

    Returns:
        Dict of metric name → value.
    """
    print("\n" + "=" * 60)
    print("EVALUATION — TEST SET (eval_loss)")
    print("=" * 60)

    # packing=True uses Unsloth's collator which expects pre-tokenized input_ids.
    # SFTTrainer only tokenizes the datasets passed at __init__ time, so a dataset
    # passed directly to evaluate() must be tokenized manually first.
    tokenizer = trainer.processing_class

    def _tokenize(examples):
        out = tokenizer(
            examples["text"],
            truncation=True,
            max_length=config.MAX_SEQ_LENGTH,
            padding=False,
        )
        out["labels"] = out["input_ids"].copy()
        return out

    tokenized_test = test_dataset.map(
        _tokenize,
        batched=True,
        remove_columns=test_dataset.column_names,
        desc="Tokenizing test set",
    )

    metrics = trainer.evaluate(eval_dataset=tokenized_test)

    # Strip the "eval_" prefix added by Trainer for display
    display = {k.replace("eval_", ""): v for k, v in metrics.items()}

    col_w = max(len(k) for k in display) + 2
    print(f"\n{'Metric':<{col_w}}  Value")
    print("─" * (col_w + 10))
    for key, value in display.items():
        if isinstance(value, float):
            print(f"  {key:<{col_w}}  {value:.4f}")
        else:
            print(f"  {key:<{col_w}}  {value}")

    return metrics


# ─── Per-sample Tester ────────────────────────────────────────────────────────

class Tester:
    """
    Generate text predictions on a subset of the test set, parse JSON verdicts,
    and report verdict accuracy with a confusion matrix.
    """

    def __init__(
        self,
        model,
        tokenizer: AutoTokenizer,
        test_dataset: Dataset,
        size: int = 100,
    ) -> None:
        self.model = model
        self.tokenizer = tokenizer
        self.size = min(size, len(test_dataset))
        # Use raw 'text' column but we need the original email + label.
        # The dataset contains the chat-formatted "text" and "label" columns.
        self.test_dataset = test_dataset.select(range(self.size))
        self.predictions: list[int] = []
        self.truths: list[int] = []
        self.parse_failures = 0

    def _generate_one(self, chat_text: str) -> str:
        """
        Given a full chat-formatted string (with assistant turn), strip the
        assistant content, apply generation prompt, and generate.

        Returns:
            Decoded model output (assistant response only).
        """
        # Build a prompt-only version (remove assistant turn) by re-constructing
        # messages from the chat text. Since we stored the full chat string,
        # we find the last <|im_start|>assistant marker and cut before it.
        assistant_marker = "<|im_start|>assistant"
        idx = chat_text.rfind(assistant_marker)
        if idx != -1:
            prompt_text = chat_text[:idx] + "<|im_start|>assistant\n"
        else:
            prompt_text = chat_text

        inputs = self.tokenizer(
            prompt_text,
            return_tensors="pt",
            truncation=True,
            max_length=config.MAX_SEQ_LENGTH - config.MAX_NEW_TOKENS,
        ).to(self.model.device)

        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=config.MAX_NEW_TOKENS,
                do_sample=False,
                temperature=None,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        # Decode only newly generated tokens
        new_ids = output_ids[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(new_ids, skip_special_tokens=True)

    def run(self) -> None:
        """Generate and evaluate predictions for self.size samples."""
        self.model.eval()
        print(f"\nRunning Tester on {self.size} samples...")
        print("─" * 60)

        for i, example in enumerate(self.test_dataset):
            chat_text = example["text"]
            true_label = int(example["label"])
            true_verdict = "SCAM" if true_label == 1 else "LEGITIMATE"

            output_text = self._generate_one(chat_text)
            pred_verdict = _parse_verdict(output_text)
            pred_label = _verdict_to_label(pred_verdict)

            if pred_verdict is None:
                self.parse_failures += 1

            correct = pred_label == true_label
            self.predictions.append(pred_label)
            self.truths.append(true_label)

            color = GREEN if correct else RED
            status = "✓" if correct else "✗"
            print(
                f"  [{i+1:>4}/{self.size}] {color}{status}{RESET}  "
                f"True: {true_verdict:<12} Pred: {pred_verdict or 'PARSE_FAIL':<12}  "
                f"| {output_text[:80].replace(chr(10), ' ')}"
            )

    def report(self) -> None:
        """Print verdict accuracy summary and confusion matrix."""
        if not self.predictions:
            print("No predictions to report. Call run() first.")
            return

        truths = np.array(self.truths)
        preds  = np.array(self.predictions)
        correct = int((truths == preds).sum())
        total   = len(truths)
        accuracy = correct / total

        cm = confusion_matrix(truths, preds)
        tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, total)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1        = (
            2 * precision * recall / (precision + recall)
            if (precision + recall) > 0 else 0.0
        )

        print("\n" + "=" * 60)
        print("TESTER RESULTS")
        print("=" * 60)
        print(f"  Samples tested:    {total}")
        print(f"  Correct verdicts:  {correct}  ({accuracy:.2%})")
        print(f"  Parse failures:    {self.parse_failures}")
        print(f"\n  Confusion Matrix:")
        print(f"    TP (SCAM→SCAM):        {tp}")
        print(f"    FP (LEGIT→SCAM):       {fp}")
        print(f"    FN (SCAM→LEGIT):       {fn}")
        print(f"    TN (LEGIT→LEGIT):      {tn}")
        print(f"\n  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1:        {f1:.4f}")

        plot_confusion_matrix(cm)

    @classmethod
    def test(
        cls,
        model,
        tokenizer: AutoTokenizer,
        test_dataset: Dataset,
        size: int = 100,
    ) -> None:
        """Convenience classmethod: construct, run, and report."""
        tester = cls(model=model, tokenizer=tokenizer, test_dataset=test_dataset, size=size)
        tester.run()
        tester.report()


# ─── Confusion matrix plot ────────────────────────────────────────────────────

def plot_confusion_matrix(cm: np.ndarray) -> None:
    """
    Plot and save a confusion matrix to confusion_matrix.png.

    Args:
        cm: 2×2 numpy confusion matrix (sklearn format).
    """
    fig, ax = plt.subplots(figsize=(6, 5))
    disp = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["LEGITIMATE", "SCAM"],
    )
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title("Sentra — Verdict Confusion Matrix")
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=150)
    print("\nConfusion matrix saved to confusion_matrix.png")
    plt.close(fig)
