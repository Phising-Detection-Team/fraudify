"""
Evaluation — test-set metrics, per-sample Tester class, and confusion matrix.

Exports:
    run_evaluation()        -> dict
    Tester                  (class)
    plot_confusion_matrix() -> None
"""

import math
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
from transformers import Trainer
from datasets import Dataset

import config

# Terminal colour codes (same pattern as reference notebooks)
GREEN  = "\033[92m"
RED    = "\033[91m"
RESET  = "\033[0m"


# ─── Full test-set evaluation ─────────────────────────────────────────────────

def run_evaluation(trainer: Trainer, test_dataset: Dataset) -> dict:
    """
    Run trainer.evaluate() on the held-out test set and print a metrics table.

    Args:
        trainer:      Trained Trainer instance.
        test_dataset: Tokenized test Dataset.

    Returns:
        Dict of metric name → value.
    """
    print("\n" + "=" * 60)
    print("EVALUATION — TEST SET")
    print("=" * 60)

    metrics = trainer.evaluate(eval_dataset=test_dataset)

    # Strip the "eval_" prefix added by Trainer for display
    display = {k.replace("eval_", ""): v for k, v in metrics.items()}

    col_w = max(len(k) for k in display) + 2
    print(f"\n{'Metric':<{col_w}}  Value")
    print("─" * (col_w + 10))
    for key, value in display.items():
        if isinstance(value, float):
            print(f"  {key:<{col_w}}{value:.4f}")
        else:
            print(f"  {key:<{col_w}}{value}")

    return metrics


# ─── Tester class ─────────────────────────────────────────────────────────────

class Tester:
    """
    Per-sample evaluator with color-coded output, styled after the reference notebooks.

    Usage:
        tester = Tester(trainer, test_dataset, tokenizer)
        tester.run(size=200)   # evaluate first 200 samples
        tester.report()        # print summary + confusion matrix
    """

    LABEL_NAMES = {0: "legitimate", 1: "phishing"}

    def __init__(self, trainer: Trainer, test_dataset: Dataset, size: int = 250):
        self.trainer = trainer
        self.test_dataset = test_dataset
        self.size = min(size, len(test_dataset))

        self.predictions: list[int] = []
        self.truths: list[int]      = []
        self.correct: list[bool]    = []

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _predict_batch(self) -> np.ndarray:
        """Run model prediction on the first self.size samples."""
        subset = self.test_dataset.select(range(self.size))
        output = self.trainer.predict(subset)
        return np.argmax(output.predictions, axis=-1)

    # ── Public API ────────────────────────────────────────────────────────────

    def run(self) -> None:
        """Predict all samples and print color-coded per-sample results."""
        print("\n" + "=" * 60)
        print(f"TESTER — {self.size} samples")
        print("=" * 60)

        preds = self._predict_batch()

        for i in range(self.size):
            pred  = int(preds[i])
            truth = int(self.test_dataset[i]["label"])
            ok    = pred == truth

            self.predictions.append(pred)
            self.truths.append(truth)
            self.correct.append(ok)

            color = GREEN if ok else RED
            pred_name  = self.LABEL_NAMES.get(pred, str(pred))
            truth_name = self.LABEL_NAMES.get(truth, str(truth))
            status     = "✓" if ok else "✗"

            print(
                f"{color}{i + 1:>4}  [{status}]  "
                f"Pred: {pred_name:<12}  Truth: {truth_name:<12}{RESET}"
            )

    def report(self) -> None:
        """Print summary statistics after run()."""
        if not self.predictions:
            print("No predictions yet — call run() first.")
            return

        total   = len(self.predictions)
        correct = sum(self.correct)
        accuracy = correct / total

        tp = sum(1 for p, t in zip(self.predictions, self.truths) if p == 1 and t == 1)
        fp = sum(1 for p, t in zip(self.predictions, self.truths) if p == 1 and t == 0)
        fn = sum(1 for p, t in zip(self.predictions, self.truths) if p == 0 and t == 1)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1        = (2 * precision * recall / (precision + recall)
                     if (precision + recall) > 0 else 0.0)

        print("\n" + "=" * 60)
        print("TESTER SUMMARY")
        print("=" * 60)
        print(f"  Samples:   {total}")
        print(f"  Correct:   {correct}  ({accuracy:.1%})")
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  Precision: {precision:.4f}  (phishing class)")
        print(f"  Recall:    {recall:.4f}  (phishing class)")
        print(f"  F1:        {f1:.4f}  (phishing class)")

        plot_confusion_matrix(self.truths, self.predictions)

    @classmethod
    def test(cls, trainer: Trainer, test_dataset: Dataset, size: int = 250) -> "Tester":
        """Convenience class method — create, run, and report in one call."""
        tester = cls(trainer, test_dataset, size=size)
        tester.run()
        tester.report()
        return tester


# ─── Confusion matrix ─────────────────────────────────────────────────────────

def plot_confusion_matrix(truths: list[int], predictions: list[int]) -> None:
    """
    Render and display a confusion matrix using matplotlib.

    Args:
        truths:      Ground-truth integer labels.
        predictions: Predicted integer labels.
    """
    cm = confusion_matrix(truths, predictions, labels=[0, 1])
    disp = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["Legitimate", "Phishing"],
    )

    fig, ax = plt.subplots(figsize=(6, 5))
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title("Confusion Matrix — Phishing Detection")
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=150)
    plt.show()
    print("Confusion matrix saved to confusion_matrix.png")
