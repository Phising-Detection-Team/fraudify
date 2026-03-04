# Testing Guide

Comprehensive test suite for database validation and constraints.

## Test Files Overview

### 1. **conftest.py** - Pytest Configuration & Fixtures
Provides shared fixtures for all tests:
- `app` - Flask application with in-memory SQLite
- `session` - Database session for testing
- `valid_round` - Pre-created valid Round fixture
- `valid_email` - Pre-created valid Email fixture
- `valid_log` - Pre-created valid Log fixture
- `valid_api_call` - Pre-created valid APICall fixture
- `valid_override` - Pre-created valid ManualOverride fixture
- Helper functions for common test operations

### 2. **test_orm_validators.py** - ORM Validation Tests (40+ tests)
Tests the `@validates` decorators on model attributes:

**Email Validators:**
- `test_detector_confidence_valid` - Accepts 0-1 range
- `test_detector_confidence_boundary_zero/one` - Tests 0.0 and 1.0
- `test_detector_confidence_negative/too_high` - Rejects invalid values
- `test_latencies_non_negative` - Validates latency values
- `test_cost_non_negative` - Validates cost >= 0

**Round Validators:**
- `test_total_emails_valid` - Accepts positive count
- `test_total_emails_zero/negative` - Rejects invalid counts
- `test_processed_emails_valid` - Accepts valid count
- `test_processed_emails_greater_than_total` - Enforces constraint
- `test_status_enum_valid/invalid` - Tests enum validation

**Log Validators:**
- `test_level_enum_valid/invalid` - Tests log level enum
- `test_message_non_empty` - Validates non-empty message
- `test_message_empty` - Rejects empty message

**API Validators:**
- `test_agent_type_enum_valid/invalid` - Tests agent type enum
- `test_tokens_non_negative` - Validates token count
- `test_cost_non_negative` - Validates cost

**Override Validators:**
- `test_verdict_enum_valid/invalid` - Tests verdict enum
- `test_email_test_id_positive/zero/negative` - Validates positive ID

### 3. **test_db_constraints.py** - Database Constraint Tests (30+ tests)
Tests CHECK and UNIQUE constraints at database level:

**Email Constraints:**
- `test_detector_confidence_range` - CHECK constraint
- `test_detector_confidence_too_high` - Rejects violation
- `test_latencies_non_negative` - CHECK latency >= 0
- `test_cost_non_negative` - CHECK cost >= 0
- `test_detector_verdict_enum` - CHECK verdict enum

**Round Constraints:**
- `test_total_emails_positive` - CHECK total > 0
- `test_processed_emails_non_negative` - CHECK >= 0
- `test_processed_emails_le_total` - CHECK processed <= total
- `test_accuracy_ranges` - CHECK accuracy 0-1
- `test_cost_non_negative` - CHECK cost >= 0
- `test_status_enum` - CHECK status enum

**Log Constraints:**
- `test_level_enum` - CHECK level enum

**API Constraints:**
- `test_agent_type_enum` - CHECK agent_type enum
- `test_tokens_non_negative` - CHECK tokens >= 0
- `test_latency_non_negative` - CHECK latency >= 0
- `test_cost_non_negative` - CHECK cost >= 0

**Override Constraints:**
- `test_verdict_enum` - CHECK verdict enum
- `test_email_test_id_unique` - UNIQUE constraint
- `test_email_test_id_positive` - CHECK > 0

**Integration:**
- `test_valid_workflow` - Complete workflow test

### 4. **test_enum_validation.py** - Enum Field Tests (50+ tests)
Tests all enum/choice field validations parametrically:

**Status Enum (Round):**
- Accepts: pending, running, completed, failed
- Rejects: invalid, PENDING, cancelled, etc.
- Case-sensitive validation

**Verdict Enums (Email, Override):**
- Accepts: phishing, legitimate
- Rejects: unknown, spam, PHISHING, etc.
- Tests both generator and detector verdicts

**Log Level Enum (Log):**
- Accepts: info, warning, error, critical
- Rejects: debug, INFO, warn, etc.

**Agent Type Enum (API):**
- Accepts: generator, detector, judge
- Rejects: model, DETECTOR, parser, etc.

**Integration Tests:**
- Complete workflow with all enum fields
- Enum consistency across relationships

### 5. **test_integration_validation.py** - End-to-End Tests (20+ tests)
Real-world workflow scenarios:

**Round Creation Workflow:**
- `test_create_round_with_emails` - Full round creation
- `test_processed_emails_cannot_exceed_total` - Constraint enforcement

**Email Processing Workflow:**
- `test_email_detection_to_override` - Detector → override flow
- `test_detector_confidence_scale` - Confidence across spectrum

**API Call Tracking:**
- `test_track_all_agent_types` - All three agent types
- `test_cost_tracking_workflow` - Cost accumulation
- `test_token_and_latency_tracking` - Performance metrics

**Error Recovery:**
- `test_recover_from_invalid_confidence` - Retry after error
- `test_recover_from_constraint_violation` - Recover from DB error

**Cascading Updates:**
- `test_round_completion_workflow` - Round → emails → completion
- `test_log_entries_during_workflow` - Logging throughout workflow

### 6. **test_edge_cases.py** - Boundary & Edge Case Tests (60+ tests)
Edge cases, boundary conditions, and special values:

**NULL Handling:**
- `test_round_id_nullable_in_log` - Optional foreign key
- `test_round_id_nullable_as_none` - NULL values in query

**Zero Boundary:**
- `test_confidence_zero_boundary` - 0.0 valid
- `test_latency_zero_valid` - Zero latency OK
- `test_cost_zero_valid` - Free processing
- `test_processed_emails_zero` - Zero processed OK

**One Value:**
- `test_total_emails_one` - Minimum valid total
- `test_confidence_near_one` - Values like 0.999

**Very Small Values:**
- `test_confidence_very_small` - 0.001, 0.0001, etc.
- `test_latency_very_small` - Microsecond latencies
- `test_cost_very_small` - Sub-cent costs

**Empty String:**
- `test_message_must_be_non_empty` - Validation
- `test_subject_can_be_empty` - Edge case

**Maximum Values:**
- `test_large_total_emails` - 1 million emails
- `test_large_token_count` - Large token usage
- `test_large_latency` - Long processing times
- `test_large_accuracy_value` - Maximum accuracy

**Range Extremes:**
- `test_confidence_range_transitions` - Key points (0, 0.25, 0.5, 0.75, 1.0)
- `test_accuracy_range_transitions` - Accuracy key points

**Processing Limits:**
- `test_processed_equals_total` - Full completion
- `test_processed_increases_through_processing` - Incremental update
- `test_cannot_exceed_total` - Prevention of over-processing

**Uniqueness:**
- `test_multiple_overrides_different_test_ids` - Multiple with different IDs

## Running Tests

### Prerequisites
```bash
cd backend
pip install -r requirements.txt
pip install pytest
```

### Run All Tests
```bash
pytest tests/ -v
```

### Run Specific Test File
```bash
pytest tests/test_orm_validators.py -v
pytest tests/test_db_constraints.py -v
pytest tests/test_enum_validation.py -v
pytest tests/test_integration_validation.py -v
pytest tests/test_edge_cases.py -v
```

### Run Specific Test Class
```bash
pytest tests/test_orm_validators.py::TestEmailValidators -v
pytest tests/test_db_constraints.py::TestRoundConstraints -v
```

### Run Specific Test
```bash
pytest tests/test_orm_validators.py::TestEmailValidators::test_detector_confidence_valid -v
```

### Run with Markers
```bash
# Run ORM tests only
pytest -m orm tests/

# Run database constraint tests only
pytest -m db tests/

# Run integration tests only
pytest -m integration tests/
```

### Run with Coverage
```bash
pytest tests/ --cov=../app/models --cov-report=html
```

### Run and Stop on First Failure
```bash
pytest tests/ -x -v
```

### Run with Detailed Output
```bash
pytest tests/ -vv --tb=long
```

### Run Tests in Parallel (faster)
```bash
pip install pytest-xdist
pytest tests/ -n auto
```

## Test Statistics

**Total Tests:** 200+

**Coverage by Category:**
- ORM Validators: 40+ tests (5 models × 8 validators)
- DB Constraints: 30+ tests (19 CHECK + 2 UNIQUE + integration)
- Enum Validation: 50+ tests (5 enum fields × parametric testing)
- Integration Workflows: 20+ tests (realistic scenarios)
- Edge Cases: 60+ tests (boundaries, nulls, extremes)

**Validation Layers Tested:**
1. ✅ ORM Layer (@validates decorators)
2. ✅ Database Layer (CHECK/UNIQUE constraints)
3. ✅ Workflow Layer (end-to-end scenarios)
4. ✅ Enum Validation (all choice fields)
5. ✅ Edge Cases (boundaries, nulls, extremes)

## Expected Results

### Successful Test Run
All tests should pass with exit code 0:
```
200+ passed in X.XXs
```

### Failed Tests
If tests fail, they indicate:
- **ORM validator not applied** - `@validates` decorator issue
- **DB constraint not enforced** - Migration not applied
- **Enum validation issue** - Invalid value accepted
- **Workflow issue** - Logic error in application
- **Database error** - Schema mismatch

## Debugging

### Enable Full Traceback
```bash
pytest tests/ --tb=long -vv
```

### Enable SQL Logging
In conftest.py, modify:
```python
app.config['SQLALCHEMY_ECHO'] = True
```

### Run Single Test with Breakpoint
```bash
pytest tests/test_orm_validators.py::TestEmailValidators::test_detector_confidence_valid -v --pdb
```

### Check Database State
```python
# In test
from app import db
print(db.session.query(Email).all())
```

## Test Patterns

### Valid Value Test
```python
def test_valid_case(self):
    obj = Model(field=valid_value)
    assert obj.field == valid_value
```

### Invalid Value Test
```python
def test_invalid_case(self, check_validator_error):
    obj = Model(field=valid_value)
    error = check_validator_error(obj, 'field', invalid_value)
    assert error is not None
```

### Database Constraint Test
```python
def test_constraint(self, session, check_db_constraint_error):
    obj = Model(field=invalid_value)
    error = check_db_constraint_error(session, obj)
    assert isinstance(error, IntegrityError)
```

### Parametric Test
```python
@pytest.mark.parametrize("value", [val1, val2, val3])
def test_multiple_values(self, value):
    obj = Model(field=value)
    assert obj.field == value
```

## Continuous Integration

To run tests in CI/CD pipeline:
```bash
# Install dependencies
pip install -r requirements.txt
pip install pytest pytest-cov

# Run tests with coverage
pytest tests/ \
    --cov=app/models \
    --cov-report=xml \
    --cov-report=term-missing \
    -v

# Exit with non-zero if coverage < 80%
pytest tests/ --cov=app/models --cov-fail-under=80
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Validation](https://docs.sqlalchemy.org/en/14/orm/extensions/hybrid.html)
- [fixtures documentation](https://docs.pytest.org/en/6.2.x/fixture.html)
- [Parametrize Documentation](https://docs.pytest.org/en/6.2.x/parametrize.html)
