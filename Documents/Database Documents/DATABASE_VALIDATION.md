# Database Validation Strategy

## Table of Contents
1. [Overview](#overview)
2. [Why Database Validation Matters](#why-database-validation-matters)
3. [Validation Layers](#validation-layers)
4. [Libraries & Tools](#libraries--tools)
5. [Validation Methods](#validation-methods)
6. [Implementation Details](#implementation-details)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This project implements **3-layer validation** to ensure data integrity:

```
┌─────────────────────────────────────────────────┐
│  LAYER 1: API INPUT VALIDATION (Pydantic)       │  [TO IMPLEMENT]
│  ✓ Validate HTTP request payloads               │
│  ✓ Type coercion & friendly error messages      │
├─────────────────────────────────────────────────┤
│  LAYER 2: ORM VALIDATION (@validates)           │  [IMPLEMENTED]
│  ✓ Validate Python object assignments           │
│  ✓ Cross-field business logic                   │
├─────────────────────────────────────────────────┤
│  LAYER 3: DATABASE VALIDATION (CHECK, UNIQUE)   │  [IMPLEMENTED]
│  ✓ Low-level enforcement at DB                  │
│  ✓ Defense against raw SQL & bugs               │
└─────────────────────────────────────────────────┘
```

---

## Why Database Validation Matters

### Problem Without Validation

```python
# Bad data can slip through:
round_obj = Round(status='sleeping')  # Invalid status stored!
email = Email(detector_confidence=1.5)  # Out of range!
override = Override(email_test_id=0)  # Invalid ID!

# Results:
# 1. Silent data corruption (hard to debug)
# 2. Business logic breaks downstream
# 3. Reports & analytics become unreliable
# 4. Security vulnerabilities
```

### Benefits With Validation

| Benefit | Impact |
|---------|--------|
| **Early error detection** | Catch bugs during development |
| **Data integrity** | No corrupt data in database |
| **Predictable behavior** | App assumes valid data |
| **Security** | SQL injection & invalid inputs blocked |
| **Debugging** | Clear error messages identify issues |
| **Compliance** | Meet data quality requirements |

**Real-world example from your project:**

```python
# Without validation:
round = Round(processed_emails=150, total_emails=100)
# Silently accepted, creates data inconsistency!

# With validation:
round = Round(processed_emails=150, total_emails=100)
# ORM @validates raises: "processed_emails cannot exceed total_emails"
# If ORM somehow misses it, DB CHECK constraint catches it:
# IntegrityError: CHECK constraint failed
```

---

## Validation Layers

### Layer 1: API Input Validation (Pydantic) — TO IMPLEMENT

**Purpose:** Validate data at entry point before touching models

**When it runs:** During HTTP request parsing

```python
from pydantic import BaseModel, Field, validator

class EmailCreateRequest(BaseModel):
    """Schema for creating an email via API"""
    round_id: int = Field(..., gt=0, description="Round ID must be positive")
    is_phishing: bool
    detector_confidence: float = Field(..., ge=0.0, le=1.0)
    # ✓ Rejects confidence > 1 with 422 Unprocessable Entity
    
    @validator('detector_confidence')
    def validate_confidence(cls, v):
        if v is None:
            return v
        if not (0.0 <= v <= 1.0):
            raise ValueError('Confidence must be between 0 and 1')
        return v
```

**Benefits:**
- ✓ Fails BEFORE database call
- ✓ HTTP 422 error with details
- ✓ Fast feedback loop
- ✓ Automatic OpenAPI docs

---

### Layer 2: ORM Validation (@validates) — IMPLEMENTED

**Purpose:** Validate Python objects during assignment

**When it runs:** When `email.detector_confidence = value` is called

**Location:** [backend/app/models/email.py](../backend/app/models/email.py)

```python
from sqlalchemy.orm import validates

class Email(db.Model):
    detector_confidence = db.Column(db.Float, nullable=True)
    
    @validates('detector_confidence')
    def validate_detector_confidence(self, key, value):
        if value is None:
            return None
        if not (0.0 <= value <= 1.0):
            raise ValueError(
                'detector_confidence must be between 0 and 1'
            )
        return float(value)
```

**How it works:**

```
email.detector_confidence = 1.5
        ↓
SQLAlchemy detects assignment
        ↓
Calls validate_detector_confidence() method
        ↓
        ├─ Valid? Return normalized value
        │       ↓ email.detector_confidence = 1.5 (accepted)
        │
        └─ Invalid? Raise ValueError
                ↓ ValueError raised, object not modified
```

**Benefits:**
- ✓ Catches mistakes in Python code
- ✓ Clear, application-specific errors
- ✓ Happens before DB commit
- ✓ Type coercion (str → float)

**Example:**

```python
# Test @validates
email = Email(round_id=1, is_phishing=True, ..., detector_confidence=0.75)
db.session.add(email)
# ✓ No error, valid value

email.detector_confidence = 1.5
# ValueError: detector_confidence must be between 0 and 1
```

---

### Layer 3: Database Validation (CHECK, UNIQUE) — IMPLEMENTED

**Purpose:** Enforce rules at database level (final defense)

**When it runs:** During INSERT/UPDATE via SQL

**Location:** [backend/migrations/versions/add_db_constraints.py](../backend/migrations/versions/add_db_constraints.py)

```sql
CREATE TABLE Emails (
    id INTEGER PRIMARY KEY,
    detector_confidence FLOAT,
    detector_verdict VARCHAR(20),
    cost FLOAT,
    ...
    CHECK (detector_confidence >= 0 AND detector_confidence <= 1),
    CHECK (detector_verdict IN ('phishing', 'legitimate')),
    CHECK (cost >= 0)
);

CREATE TABLE Rounds (
    processed_emails INTEGER,
    total_emails INTEGER,
    ...
    CHECK (processed_emails <= total_emails)
);

CREATE TABLE Manual_Overrides (
    email_test_id INTEGER UNIQUE,
    ...
);
```

**Why it catches things ORM misses:**

```python
# Raw SQL bypasses ORM:
db.session.execute(
    "UPDATE Emails SET detector_confidence = 1.5 WHERE id = 1"
)
db.session.commit()
# ← ORM @validates never runs!
# But DB CHECK constraint catches it:
# IntegrityError: CHECK constraint violation

# Direct DB access bypasses everything:
import sqlite3
conn = sqlite3.connect('app.db')
conn.execute("UPDATE Emails SET cost = -10 WHERE id = 1")
# ← Still caught by DB constraint!
```

**Benefits:**
- ✓ Last line of defense
- ✓ Works even if Python code has bugs
- ✓ Works with raw SQL
- ✓ Multi-database support (SQLite, Postgres, MySQL)

---

## Libraries & Tools

### 1. SQLAlchemy (ORM Layer)

**What it is:** Python library that maps Python classes to database tables

**What we use:**

```python
from sqlalchemy.orm import validates
from sqlalchemy import CheckConstraint, UniqueConstraint

# Define columns
class Email(db.Model):
    detector_confidence = db.Column(db.Float, nullable=True)
    
    # Add ORM validators
    @validates('detector_confidence')
    def validate_detector_confidence(self, key, value):
        ...
```

**Why:**
- ✓ Abstracts database differences
- ✓ Built-in validation hooks
- ✓ SQL generation from Python code
- ✓ Relationship management

**Docs:** https://docs.sqlalchemy.org/en/20/

---

### 2. Alembic (Migration Tool)

**What it is:** Database schema versioning & migration tool

**What we use:**

```python
# In backend/migrations/versions/add_db_constraints.py

def upgrade():
    """Add constraints to database"""
    op.create_check_constraint(
        'ck_email_detector_confidence_range',
        'Emails',
        'detector_confidence >= 0 AND detector_confidence <= 1'
    )

def downgrade():
    """Remove constraints (rollback)"""
    op.drop_constraint('ck_email_detector_confidence_range', 'Emails')
```

**Why:**
- ✓ Version-control for database schema
- ✓ Safely add/remove constraints in production
- ✓ Rollback capability
- ✓ Track schema evolution

**Key commands:**

```bash
# Create initial schema
alembic revision --autogenerate -m "Initial schema"

# Create constraints migration
alembic revision -m "Add validations"

# Apply all pending migrations
alembic upgrade head

# Check current version
alembic current

# Rollback one migration
alembic downgrade -1
```

**Files:**
- [f68964d2d980_initial_schema.py](../backend/migrations/versions/f68964d2d980_initial_schema.py) — Creates tables
- [add_db_constraints.py](../backend/migrations/versions/add_db_constraints.py) — Adds constraints

---

### 3. Pydantic (API Validation) — TO IMPLEMENT

**What it is:** Data validation & serialization library for Python

**What we'll use:**

```python
from pydantic import BaseModel, Field, validator

class EmailCreateSchema(BaseModel):
    """Validate email creation requests"""
    round_id: int = Field(..., gt=0)
    is_phishing: bool
    detector_confidence: float = Field(..., ge=0.0, le=1.0)
    
    class Config:
        # Optional: add validation config
        allow_population_by_field_name = True
```

**Why:**
- ✓ Automatic HTTP 422 errors
- ✓ Type hints & IDE support
- ✓ JSON serialization/deserialization
- ✓ OpenAPI schema generation
- ✓ Custom validators

**Docs:** https://docs.pydantic.dev/

---

## Validation Methods

### Method 1: CHECK Constraints

**What:** SQL rule that must be true for all rows

**Syntax:**
```sql
CHECK (column_name operator value)
CHECK (column1 >= minimum AND column1 <= maximum)
CHECK (column1 IN ('val1', 'val2', 'val3'))
```

**Examples from our project:**

```python
# Range validation
CheckConstraint('detector_confidence >= 0 AND detector_confidence <= 1')
# ✓ Confidence must be 0–1

# Non-negative validation
CheckConstraint('cost IS NULL OR cost >= 0')
# ✓ Cost is either NULL or >= 0

# Enum validation
CheckConstraint("status IN ('pending','running','completed','failed')")
# ✓ Status is one of 4 values

# Cross-column validation (relationship)
CheckConstraint('processed_emails <= total_emails')
# ✓ Processed can't exceed total

# Complex logic
CheckConstraint('detector_accuracy IS NULL OR (detector_accuracy >= 0 AND detector_accuracy <= 100)')
# ✓ Accuracy is NULL or 0–100
```

**When violated:**

```python
db.session.execute(
    "INSERT INTO Rounds (total_emails, processed_emails) VALUES (10, 15)"
)
db.session.commit()
# IntegrityError: CHECK constraint 'ck_round_processed_le_total' failed
```

**Trade-offs:**
- ✓ Works across all DBs (portable)
- ✓ Fast enforcement
- ✗ Limited to SQL expressions
- ✗ Complex logic better in application

---

### Method 2: UNIQUE Constraints

**What:** Ensures no duplicate values in a column/set of columns

**Syntax:**
```sql
UNIQUE (column_name)
UNIQUE (column1, column2)  -- Composite unique
```

**Example from our project:**

```python
# Each email can have at most ONE override
UniqueConstraint('email_test_id', name='uq_override_email_test_id')
```

**When violated:**

```python
# First override
override1 = Override(email_test_id=5, verdict='correct')
db.session.add(override1)
db.session.commit()  # ✓ OK

# Try second override for same email
override2 = Override(email_test_id=5, verdict='incorrect')
db.session.add(override2)
db.session.commit()
# IntegrityError: UNIQUE constraint 'uq_override_email_test_id' failed
```

**Trade-offs:**
- ✓ Simple & portable
- ✓ DB enforces automatically
- ✗ NULL handling (depends on DB)
- ✗ Can't do conditional uniqueness

---

### Method 3: @validates (ORM)

**What:** Python method that's called during attribute assignment

**Syntax:**
```python
@validates('column_name')
def validate_column_name(self, key, value):
    # validate logic
    if invalid:
        raise ValueError("error message")
    return normalized_value
```

**Example from our project:**

```python
@validates('detector_verdict')
def validate_detector_verdict(self, key, value):
    allowed = {'phishing', 'legitimate'}
    if value not in allowed:
        raise ValueError(
            f"detector_verdict must be one of {allowed}"
        )
    return value
```

**When runs:**

```python
# During attribute assignment
email.detector_verdict = 'invalid'
# ValueError: detector_verdict must be one of {'phishing', 'legitimate'}

# During construction
email = Email(detector_verdict='invalid', ...)
# ValueError raised

# NOT when querying (data already valid in DB)
email = Email.query.get(1)  # Loads from DB
```

**Trade-offs:**
- ✓ Complex validation logic possible
- ✓ Good error messages
- ✓ Python access to other attributes
- ✗ Only works with ORM
- ✗ Useless for raw SQL

---

### Method 4: NOT NULL Constraints

**What:** Ensures column must have a value (can't be NULL)

**Syntax:**
```sql
column_name datatype NOT NULL
```

**Example:**

```python
# Field must exist
created_at = db.Column(
    db.DateTime,
    default=datetime.utcnow,
    nullable=False  # ← NOT NULL in SQL
)

# Field can be empty
notes = db.Column(
    db.Text,
    nullable=True  # ← NULL allowed (optional)
)
```

**Trade-offs:**
- ✓ Simplest validation
- ✓ Zero overhead
- ✓ Works everywhere
- ✗ Only checks existence, not value

---

## Implementation Details

### Current Implementation Status

#### ✅ COMPLETED: Layer 2 & 3 (ORM + Database)

**ORM Validators Added:**

| File | Validators | Purpose |
|------|-----------|---------|
| [email.py](../backend/app/models/email.py) | 5 methods | confidence, verdict, latencies, cost, is_phishing |
| [round.py](../backend/app/models/round.py) | 3 methods | processed_emails, total_emails, status |
| [log.py](../backend/app/models/log.py) | 2 methods | level, message |
| [api.py](../backend/app/models/api.py) | 3 methods | agent_type, token/latency/cost non-negative |
| [human_override.py](../backend/app/models/human_override.py) | 2 methods | verdict, email_test_id |

**Database Constraints Applied:**

| Table | Constraints | Count |
|-------|-------------|-------|
| Emails | Confidence 0–1, latencies≥0, cost≥0, verdict enum, time≥0 | 6 |
| Rounds | total>0, processed≥0, processed≤total, status enum, accuracy 0–100, success 0–100, cost≥0 | 8 |
| Logs | level enum | 1 |
| API_calls | agent_type enum, token≥0, cost≥0, latency≥0 | 4 |
| Manual_Overrides | verdict enum, unique email_test_id | 2 |
| **Total** | | **21** |

**Migrations:**

```bash
# Initial schema created
alembic current
# Output: f68964d2d980 (initial schema)

# Constraints added
alembic upgrade head
# Output: add_db_constraints (head)
```

---

#### ⏳ TODO: Layer 1 (API Validation with Pydantic)

**Next step:** Create Pydantic schemas for Flask/FastAPI endpoints

**Example schema to create:**

```python
# app/schemas.py

from pydantic import BaseModel, Field, validator
from typing import Optional

class EmailBaseSchema(BaseModel):
    """Base schema for Email"""
    round_id: int = Field(..., gt=0, description="Round ID")
    is_phishing: bool
    detector_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    detector_verdict: str = Field(..., description="'phishing' or 'legitimate'")
    
    @validator('detector_verdict')
    def validate_verdict(cls, v):
        if v not in {'phishing', 'legitimate'}:
            raise ValueError('Must be phishing or legitimate')
        return v

class RoundCreateSchema(BaseModel):
    """Schema for creating a round"""
    status: str = Field(..., description="pending, running, completed, or failed")
    total_emails: int = Field(..., gt=0, description="Must be > 0")
    
    @validator('status')
    def validate_status(cls, v):
        if v not in {'pending', 'running', 'completed', 'failed'}:
            raise ValueError('Invalid status')
        return v
```

---

## Best Practices

### 1. Use All Three Layers

❌ **Bad:** Only database constraints
```python
# Only CHECK constraints, no ORM or API validation
# → Poor error messages for users
# → Slow feedback loop
```

✅ **Good:** All three layers
```python
# API validation (Pydantic) → ORM validation (@validates) → DB (CHECK)
# Fast response, clear errors, fallback protection
```

---

### 2. Make Constraint Names Descriptive

❌ **Bad:**
```python
CheckConstraint('value >= 0', name='c1')  # What does c1 mean?
```

✅ **Good:**
```python
CheckConstraint('value >= 0', name='ck_email_cost_nonneg')
# ck_ = check constraint
# email_ = table name
# cost_nonneg = what it validates
```

**Naming convention:**
- `ck_` prefix for CHECK constraints
- `uq_` prefix for UNIQUE constraints
- `fk_` prefix for FOREIGN KEY
- Include table name for clarity

---

### 3. Allow NULL for Optional Fields

❌ **Bad:**
```python
CheckConstraint('notes >= 0')  # Rejects NULL even if nullable=True!
```

✅ **Good:**
```python
# If column can be NULL, allow it in CHECK:
CheckConstraint('notes IS NULL OR LENGTH(notes) > 0')
CheckConstraint('cost IS NULL OR cost >= 0')
```

---

### 4. Don't Over-Validate

❌ **Bad:** Validate every field
```python
@validates('first_name')
def validate_first_name(self, key, value):
    if not isinstance(value, str):
        raise ValueError(...)
    if len(value) < 2:
        raise ValueError(...)
    # SQLAlchemy already handles type checking
```

✅ **Good:** Validate business logic only
```python
@validates('detector_confidence')
def validate_detector_confidence(self, key, value):
    # Type is already checked by db.Column(db.Float)
    if not (0.0 <= value <= 1.0):  # Business rule
        raise ValueError(...)
    return value
```

---

### 5. Provide Context in Error Messages

❌ **Bad:**
```python
raise ValueError('Invalid')
```

✅ **Good:**
```python
raise ValueError(
    f'detector_confidence must be between 0 and 1, '
    f'got {value}'
)
```

---

### 6. Test All Layers

```python
# Test ORM validation
def test_orm_validation():
    with pytest.raises(ValueError):
        email = Email(detector_confidence=1.5)

# Test DB validation
def test_db_constraint():
    email = Email(...)
    db.session.add(email)
    with pytest.raises(IntegrityError):
        # Raw SQL that violates constraint
        db.session.execute(
            "UPDATE Emails SET detector_confidence = 1.5"
        )
        db.session.commit()

# Test API validation (Pydantic)
def test_api_validation():
    with pytest.raises(ValidationError):
        EmailSchema(detector_confidence=1.5)
```

---

## Troubleshooting

### Problem 1: "CHECK constraint failed"

**Cause:** DB constraint violated

```
IntegrityError: CHECK constraint 'ck_email_detector_confidence_range' failed
```

**Solution:**
1. Check constraint name (identifies which rule failed)
2. Verify value being inserted
3. Add ORM @validates to catch earlier

```python
# Add more specific error handling:
try:
    db.session.commit()
except IntegrityError as e:
    if 'ck_email_detector_confidence_range' in str(e):
        raise ValueError(
            'Confidence must be between 0 and 1'
        )
```

---

### Problem 2: "@validates not running"

**Cause:** Using raw SQL (bypasses ORM)

```python
# @validates doesn't run here:
db.session.execute(
    "UPDATE Emails SET detector_confidence = 1.5"
)
```

**Solution:** Use ORM when possible

```python
# @validates runs here:
email = Email.query.get(1)
email.detector_confidence = 0.8
db.session.commit()
```

---

### Problem 3: "Migration fails on SQLite"

**Cause:** SQLite doesn't support direct ALTER

```
NotImplementedError: No support for ALTER of constraints in SQLite dialect
```

**Solution:** Migration already handles this with batch mode

```python
# In add_db_constraints.py:
is_sqlite = bind.dialect.name == 'sqlite'
if is_sqlite:
    with op.batch_alter_table(table) as batch_op:
        batch_op.create_check_constraint(...)
```

---

### Problem 4: "Constraint name conflict"

**Cause:** Constraint names must be unique

```
IntegrityError: duplicate constraint name
```

**Solution:** Use descriptive, unique names

```python
# Bad (generic):
CheckConstraint('value >= 0', name='ck_check_1')

# Good (unique & descriptive):
CheckConstraint('value >= 0', name='ck_email_cost_nonneg')
```

---

## Summary Table

| Aspect | Layer 1 (API) | Layer 2 (ORM) | Layer 3 (DB) |
|--------|--------|---------|---------|
| **Library** | Pydantic | SQLAlchemy | SQL/Alembic |
| **When Runs** | HTTP parsing | Assignment | INSERT/UPDATE |
| **Error Type** | HTTP 422 | ValueError | IntegrityError |
| **Catches** | Bad input formats | Programmatic errors | Any SQL |
| **Performance** | Very fast | Fast | Slower (DB check) |
| **User Feedback** | Excellent | Good | Generic |
| **Status** | TODO | ✅ Done | ✅ Done |

---

## Resources

- **SQLAlchemy Docs:** https://docs.sqlalchemy.org/
- **Alembic Docs:** https://alembic.sqlalchemy.org/
- **Pydantic Docs:** https://docs.pydantic.dev/
- **Python sqlite3:** https://docs.python.org/3/library/sqlite3.html

---

## Questions?

For questions about validation implementation, check:
1. [backend/app/models/](../backend/app/models/) — ORM validators
2. [backend/migrations/versions/add_db_constraints.py](../backend/migrations/versions/add_db_constraints.py) — DB constraints
3. [tests/test_model_validators.py](../tests/test_model_validators.py) — ORM tests
4. [tests/test_db_constraints.py](../tests/test_db_constraints.py) — DB constraint tests
