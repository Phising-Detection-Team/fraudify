"""
Data pipeline — load, preprocess, merge, split, and tokenize datasets.

Exports:
    load_datasets()         -> tuple[Dataset, Dataset]
    preprocess_and_merge()  -> Dataset
    split_dataset()         -> DatasetDict
    tokenize_datasets()     -> tuple[DatasetDict, AutoTokenizer, DataCollatorWithPadding]
"""

from datasets import Dataset, DatasetDict, concatenate_datasets, load_dataset
from transformers import AutoTokenizer, DataCollatorWithPadding

import config


# ─── Label constants ──────────────────────────────────────────────────────────

LABEL_LEGITIMATE = 0
LABEL_PHISHING = 1


# ─── Load ─────────────────────────────────────────────────────────────────────

def load_datasets() -> tuple[Dataset, Dataset | None]:
    """
    Load source datasets from HuggingFace and print a summary of each.
    Datasets that use legacy loading scripts (incompatible with datasets>=3.0)
    are skipped with a warning rather than crashing the pipeline.

    Returns:
        (enron_dataset, phishing_dataset_or_None)
    """
    print("\n" + "=" * 60)
    print("LOADING DATASETS")
    print("=" * 60)

    enron_raw = load_dataset("SetFit/enron_spam", split="train")
    _print_dataset_summary("SetFit/enron_spam", enron_raw)

    phishing_raw: Dataset | None = None
    try:
        phishing_raw = load_dataset("ealvaradob/phishing-dataset", split="train")
        _print_dataset_summary("ealvaradob/phishing-dataset", phishing_raw)
    except RuntimeError as exc:
        if "no longer supported" in str(exc):
            print(
                "\n[WARNING] ealvaradob/phishing-dataset uses a legacy loading script "
                "incompatible with datasets>=3.0. Continuing with SetFit/enron_spam only.\n"
                "  To use it: pip install \"datasets<3.0.0\" and add trust_remote_code=True."
            )
        else:
            raise

    return enron_raw, phishing_raw


def _print_dataset_summary(name: str, dataset: Dataset) -> None:
    print(f"\n{'─' * 40}")
    print(f"Dataset: {name}")
    print(f"  Size:    {len(dataset):,} rows")
    print(f"  Columns: {dataset.column_names}")
    print(f"  Sample row:\n    {dataset[0]}")

    # Print label distribution if a label-like column exists
    for col in ("label", "Label", "spam", "is_phishing", "class"):
        if col in dataset.column_names:
            counts: dict[int, int] = {}
            for val in dataset[col]:
                counts[val] = counts.get(val, 0) + 1
            print(f"  Label distribution ({col}): {counts}")
            break


# ─── Preprocess ───────────────────────────────────────────────────────────────

def preprocess_and_merge(
    enron_raw: Dataset,
    phishing_raw: Dataset | None,
) -> Dataset:
    """
    Normalize datasets to {"text": str, "label": int} and merge them.
    phishing_raw may be None if it could not be loaded.

    Label mapping:
        Enron spam: ham (0) → 0 (legitimate), spam (1) → 1 (phishing)
        phishing-dataset: maps its positive class → 1, negative → 0

    Returns:
        Merged and shuffled Dataset with columns ["text", "label"]
    """
    print("\n" + "=" * 60)
    print("PREPROCESSING & MERGING")
    print("=" * 60)

    enron_clean = _normalize_enron_spam(enron_raw)

    if phishing_raw is not None:
        phishing_clean = _normalize_phishing_dataset(phishing_raw)
        merged = concatenate_datasets([enron_clean, phishing_clean])
    else:
        merged = enron_clean
    merged = merged.shuffle(seed=42)

    # Print merged distribution
    counts: dict[int, int] = {}
    for val in merged["label"]:
        counts[val] = counts.get(val, 0) + 1
    print(f"\nMerged dataset: {len(merged):,} rows")
    print(f"  Label distribution: {counts}")
    print(f"  Phishing ratio: {counts.get(1, 0) / len(merged):.1%}")

    return merged


def _normalize_enron_spam(dataset: Dataset) -> Dataset:
    """
    SetFit/enron_spam schema: 'text' (email body), 'label' (0=ham, 1=spam),
    'label_text' ('ham'/'spam'), 'subject', 'message_id'.
    Label maps directly: ham=0 (legitimate), spam=1 (phishing).
    """
    def _map(example: dict) -> dict:
        text = (
            example.get("text")
            or example.get("body")
            or example.get("message")
            or ""
        )
        label = int(example.get("label", 0))
        return {"text": str(text).strip(), "label": label}

    normalized = dataset.map(_map, remove_columns=dataset.column_names)
    normalized = normalized.filter(lambda x: len(x["text"]) > 0)
    print(f"\nEnron spam after normalization: {len(normalized):,} rows")
    return normalized


def _normalize_phishing_dataset(dataset: Dataset) -> Dataset:
    """
    ealvaradob/phishing-dataset schema: inspect and map to {"text", "label"}.
    Positive (phishing) class → 1, negative (legitimate) → 0.
    """
    cols = dataset.column_names

    # Determine the text column
    text_col = next(
        (c for c in ("text", "body", "message", "email", "content", "Email Text") if c in cols),
        cols[0],
    )
    # Determine the label column
    label_col = next(
        (c for c in ("label", "Label", "class", "Class", "is_phishing", "spam") if c in cols),
        None,
    )

    print(f"\nPhishing dataset — using text_col='{text_col}', label_col='{label_col}'")

    # Collect unique label values to determine positive class
    if label_col:
        unique_labels = list(set(dataset[label_col]))
        print(f"  Unique label values: {unique_labels}")
        # Heuristic: if labels are strings, 'phishing'/'spam'/'1' → 1
        positive_values = {"phishing", "spam", "1", 1, True, "true", "Phishing", "Spam"}

        def _map(example: dict) -> dict:
            text = str(example.get(text_col, "")).strip()
            raw = example.get(label_col)
            label = LABEL_PHISHING if raw in positive_values else LABEL_LEGITIMATE
            return {"text": text, "label": label}
    else:
        # No label column found — assume all rows are phishing (dataset name implies it)
        print("  No label column found — assuming all rows are phishing (label=1)")

        def _map(example: dict) -> dict:
            text = str(example.get(text_col, "")).strip()
            return {"text": text, "label": LABEL_PHISHING}

    normalized = dataset.map(_map, remove_columns=dataset.column_names)
    normalized = normalized.filter(lambda x: len(x["text"]) > 0)
    print(f"\nPhishing dataset after normalization: {len(normalized):,} rows")
    return normalized


# ─── Split ────────────────────────────────────────────────────────────────────

def split_dataset(merged: Dataset) -> DatasetDict:
    """
    Split merged dataset into 80% train, 10% validation, 10% test.

    Returns:
        DatasetDict with keys "train", "validation", "test"
    """
    print("\n" + "=" * 60)
    print("SPLITTING DATASET")
    print("=" * 60)

    # First split off 20% for val+test
    split_1 = merged.train_test_split(test_size=0.2, seed=42)
    # Split the 20% evenly into val and test
    split_2 = split_1["test"].train_test_split(test_size=0.5, seed=42)

    dataset_dict = DatasetDict({
        "train":      split_1["train"],
        "validation": split_2["train"],
        "test":       split_2["test"],
    })

    for split_name, ds in dataset_dict.items():
        counts: dict[int, int] = {}
        for val in ds["label"]:
            counts[val] = counts.get(val, 0) + 1
        print(f"  {split_name:12s}: {len(ds):>7,} rows  |  {counts}")

    return dataset_dict


# ─── Tokenize ─────────────────────────────────────────────────────────────────

def tokenize_datasets(
    dataset_dict: DatasetDict,
) -> tuple[DatasetDict, AutoTokenizer, DataCollatorWithPadding]:
    """
    Tokenize all splits using the BASE_MODEL tokenizer.

    Returns:
        (tokenized_DatasetDict, tokenizer, data_collator)
    """
    print("\n" + "=" * 60)
    print("TOKENIZING")
    print("=" * 60)

    tokenizer = AutoTokenizer.from_pretrained(
        config.BASE_MODEL,
        trust_remote_code=True,
    )

    def _tokenize(batch: dict) -> dict:
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=config.MAX_SEQ_LENGTH,
            padding=False,   # DataCollatorWithPadding handles dynamic padding
        )

    tokenized = dataset_dict.map(
        _tokenize,
        batched=True,
        remove_columns=["text"],
        desc="Tokenizing",
    )
    tokenized.set_format("torch")

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    print(f"\nTokenizer: {config.BASE_MODEL}")
    print(f"Max sequence length: {config.MAX_SEQ_LENGTH}")
    print(f"Tokenized splits: {list(tokenized.keys())}")

    return tokenized, tokenizer, data_collator
