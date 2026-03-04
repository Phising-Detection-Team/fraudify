# Testing Checklist & Quickstart

## ✅ Test Suite Created Successfully

Your comprehensive test folder has been created with **200+ tests** covering all validation layers.

### Files Created

| File | Purpose | Tests |
|------|---------|-------|
| `conftest.py` | Pytest fixtures & app config | - |
| `test_orm_validators.py` | ORM @validates decorator tests | 40+ |
| `test_db_constraints.py` | Database constraint tests | 30+ |
| `test_enum_validation.py` | Enum field validation tests | 50+ |
| `test_integration_validation.py` | End-to-end workflow tests | 20+ |
| `test_edge_cases.py` | Boundary & edge case tests | 60+ |
| `pytest.ini` | Pytest configuration | - |
| `README.md` | Test documentation | - |

**Total: 200+ Tests**

## 🚀 Quick Start

### 1. Install Pytest
```bash
cd backend
pip install pytest
```

### 2. Run All Tests
```bash
pytest tests/ -v
```

Expected output:
```
200+ passed in X.XXs
```

### 3. Run Specific Category
```bash
# ORM validators only
pytest tests/test_orm_validators.py -v

# Database constraints only
pytest tests/test_db_constraints.py -v

# Enum validation only
pytest tests/test_enum_validation.py -v

# Integration workflows only
pytest tests/test_integration_validation.py -v

# Edge cases only
pytest tests/test_edge_cases.py -v
```

## 📋 What Gets Tested

### 1. ORM Validators (40+ tests)
Your `@validates` decorators on model attributes:

✅ Email.detector_confidence (0-1 range)
✅ Email.generator_latency_ms (>= 0)
✅ Email.detector_latency_ms (>= 0)
✅ Email.judge_latency_ms (>= 0)
✅ Email.cost (>= 0)
✅ Round.total_emails (> 0)
✅ Round.processed_emails (<= total_emails)
✅ Round.status (enum: pending/running/completed/failed)
✅ Log.level (enum: info/warning/error/critical)
✅ Log.message (non-empty)
✅ APICall.agent_type (enum: generator/detector/judge)
✅ APICall.tokens_used (>= 0)
✅ APICall.latency_ms (>= 0)
✅ APICall.cost (>= 0)
✅ ManualOverride.verdict (enum: phishing/legitimate)
✅ ManualOverride.email_test_id (> 0)

### 2. Database Constraints (30+ tests)
Your 21 CHECK and UNIQUE constraints:

✅ Email: 6 checks (confidence, latencies, cost, verdict)
✅ Round: 8 checks (totals, accuracy, status, cost)
✅ Log: 1 check (level)
✅ APICall: 4 checks (agent_type, tokens, latency, cost)
✅ ManualOverride: 2 constraints (verdict check + unique email_test_id)

### 3. Enum Validation (50+ tests)
All enum fields with parametric testing:

✅ Round.status: `pending`, `running`, `completed`, `failed`
✅ Email.generator_verdict: `phishing`, `legitimate`
✅ Email.detector_verdict: `phishing`, `legitimate`
✅ Log.level: `info`, `warning`, `error`, `critical`
✅ APICall.agent_type: `generator`, `detector`, `judge`
✅ ManualOverride.verdict: `phishing`, `legitimate`

### 4. Integration Workflows (20+ tests)
Real-world scenarios:

✅ Create round → add emails → process → complete
✅ Email detection → manual override → logging
✅ Track API calls → accumulate costs → log metrics
✅ Process emails incrementally with constraint checks

### 5. Edge Cases (60+ tests)
Boundary conditions and special values:

✅ NULL values (nullable fields)
✅ Zero values (latency=0, cost=0, processed=0)
✅ Boundary values (confidence=0.0 and 1.0)
✅ Very small values (0.001, 0.0001)
✅ Very large values (1M emails, 1M tokens)
✅ Empty strings (message validation)
✅ Range transitions (0, 0.25, 0.5, 0.75, 1.0)

## 🔍 Validation Layers

Your code validates at THREE layers:

| Layer | Location | Validation | Tests |
|-------|----------|-----------|-------|
| **Layer 1 (ORM)** | `@validates` | Application logic | 40+ |
| **Layer 2 (DB)** | CHECK/UNIQUE | Database constraints | 30+ |
| **Layer 3 (Workflow)** | Integration | Real-world scenarios | 20+ |

All three layers work together for defense-in-depth validation.

## 📊 Test Coverage Breakdown

### By Validation Type
- **Range Validation**: 40+ tests
- **Enum Validation**: 50+ tests  
- **Relational Validation**: 15+ tests (processed <= total)
- **Uniqueness Validation**: 5+ tests
- **Workflow Validation**: 20+ tests
- **Edge Case Validation**: 60+ tests

### By Model
- **Email**: 40+ tests
- **Round**: 30+ tests
- **Log**: 15+ tests
- **APICall**: 20+ tests
- **ManualOverride**: 15+ tests
- **Integration**: 90+ tests

## 🎯 Key Test Examples

### Example 1: ORM Validator Test
```python
def test_detector_confidence_valid(self, valid_round):
    """Should accept confidence between 0 and 1"""
    email = Email(
        round_id=valid_round.id,
        # ... other fields ...
        detector_confidence=0.95,  # Valid: between 0 and 1
    )
    assert email.detector_confidence == 0.95
```

### Example 2: Database Constraint Test
```python
def test_detector_confidence_too_high(self, session, check_db_constraint_error):
    """Should reject confidence > 1 at database level"""
    email = Email(
        # ... other fields ...
        detector_confidence=1.5,  # Invalid: > 1
    )
    error = check_db_constraint_error(session, email)
    assert isinstance(error, IntegrityError)
```

### Example 3: Enum Validation Test
```python
@pytest.mark.parametrize("status", ["pending", "running", "completed", "failed"])
def test_valid_status_values(self, status):
    """Should accept all valid status enum values"""
    round_obj = Round(status=status, ...)
    assert round_obj.status == status
```

### Example 4: Edge Case Test
```python
def test_confidence_zero_boundary(self, valid_round):
    """Confidence = 0.0 should be valid (definitely legitimate)"""
    email = Email(
        detector_confidence=0.0,  # Boundary: minimum valid
    )
    assert email.detector_confidence == 0.0
```

### Example 5: Integration Workflow Test
```python
def test_email_detection_to_override(self, session, valid_round):
    """Test email from detection through manual override"""
    # 1. Create email with detector results
    email = Email(detector_verdict="phishing", ...)
    session.add(email)
    session.commit()
    
    # 2. Log API call
    api_call = APICall(agent_type="detector", ...)
    session.add(api_call)
    session.commit()
    
    # 3. Manual override
    override = ManualOverride(verdict="legitimate", ...)
    session.add(override)
    session.commit()
    
    # Verify workflow completed successfully
    assert email.detector_verdict == "phishing"
    assert override.verdict == "legitimate"
```

## 🧪 Running Tests Interactively

### See What Happens in Real Time
```bash
pytest tests/test_orm_validators.py::TestEmailValidators::test_detector_confidence_valid -v -s
```

### Stop at First Failure
```bash
pytest tests/ -x -v
```

### Show Last 10 Failed Tests
```bash
pytest tests/ --lf -v
```

### Run Tests Only from Modified Files
```bash
pytest --testmon tests/
```

### Generate HTML Report
```bash
pytest tests/ --html=report.html
```

## ✨ Validation Results

When you run tests successfully:

✅ **ORM Layer** - All `@validates` methods execute correctly
✅ **Database Layer** - All CHECK/UNIQUE constraints enforced
✅ **Workflow Layer** - End-to-end scenarios work flawlessly
✅ **Enum Validation** - All choice fields properly validated
✅ **Edge Cases** - Boundary conditions handled correctly

## 🔧 Troubleshooting

### Tests Won't Run
```bash
# Check pytest is installed
pip list | grep pytest

# Check backend module can be imported
cd tests
python -c "import sys; sys.path.insert(0, '../backend'); from app import create_app; print('OK')"
```

### Import Errors
```bash
# Ensure you're in the right directory
cd /path/to/phishing_detection/backend

# Install requirements
pip install -r requirements.txt
pip install pytest
```

### Database Errors
```bash
# Tests use in-memory SQLite (no setup needed)
# If issues persist, delete app.db and run migrations:
cd backend
python -m alembic upgrade head
```

### Test Failures
1. Check the error message
2. Review the test code
3. Check the model validators
4. Verify database migrations applied
5. Run with more verbose output: `pytest -vv --tb=long`

## 📚 Documentation

Full documentation available in:
- **tests/README.md** - Test file descriptions
- **tests/pytest.ini** - Pytest configuration
- **TESTING_GUIDE.md** - Complete testing guide
- **Documents/DATABASE_VALIDATION.md** - Validation architecture

## 🎓 Learning Path

1. **Start here**: Run all tests
   ```bash
   pytest tests/ -v
   ```

2. **Understand ORM validators**
   ```bash
   pytest tests/test_orm_validators.py -v
   ```

3. **Explore database constraints**
   ```bash
   pytest tests/test_db_constraints.py -v
   ```

4. **Run integration scenarios**
   ```bash
   pytest tests/test_integration_validation.py -v
   ```

5. **Check edge cases**
   ```bash
   pytest tests/test_edge_cases.py -v
   ```

## 🚢 Next Steps

### 1. Run Tests (Immediate)
```bash
cd backend
pytest tests/ -v
```

### 2. Review Test Results
- Count passing/failing tests
- Review any failures
- Check coverage report

### 3. Integrate with CI/CD
Add to GitHub Actions / Pipeline:
```yaml
- name: Run validation tests
  run: pytest tests/ -v --cov=app/models
```

### 4. Add More Tests
Use patterns from existing tests to add:
- API endpoint tests
- Performance benchmarks
- Additional edge cases

### 5. Monitor Validation
Use test results to:
- Track validation quality
- Identify common errors
- Improve error messages

## 📞 Support

- Check test file headers for documentation
- Review conftest.py for available fixtures
- See TESTING_GUIDE.md for detailed information
- Check DATABASE_VALIDATION.md for architecture
