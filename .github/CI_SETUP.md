# GitHub Actions CI/CD Setup Guide

This document explains how to configure the GitHub Actions CI pipeline for the Phishing Detection project.

## Overview

The CI pipeline (`.github/workflows/ci.yml`) automatically runs tests on:
- Every push to `master` or `main` branch
- Every pull request to `master` or `main` branch

**Tests:**
- Python 3.12
- PostgreSQL 15 (containerized)
- All tests in `tests/` directory using pytest

**Notifications:**
- Email notifications on test failure (recommended to avoid noise)
- Email notifications on test success (optional)

---

## Setup Instructions

### 1. Create GitHub Repository Secrets

To enable email notifications, you need to configure GitHub Secrets in your repository.

**Steps:**
1. Go to: **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add the following secrets:

#### Required Secrets:

**a) `EMAIL_USERNAME`**
- **Description:** Gmail email address for sending notifications
- **Value:** `your-email@gmail.com`
- **Note:** Use an email address you control

**b) `EMAIL_PASSWORD`**
- **Description:** Gmail App Password (NOT your regular password)
- **Steps to generate:**
  1. Go to [Google Account Security](https://myaccount.google.com/security)
  2. Enable 2-Factor Authentication (if not already enabled)
  3. Go to **App Passwords** (appears after enabling 2FA)
  4. Select "Mail" and "Windows Computer"
  5. Google will generate a 16-character password
  6. Copy this password and paste it into GitHub Secrets
- **Example:** `abcd efgh ijkl mnop` (spaces are normal)

**c) `EMAIL_RECIPIENTS`**
- **Description:** Comma-separated list of emails to receive notifications
- **Value:** `team@example.com,developer@example.com`
- **Note:** Can be single email or multiple emails separated by commas

### 2. Verify Configuration

To test that everything is working:

1. Make a commit to the `master` branch or create a pull request
2. Go to **Actions** tab in your GitHub repository
3. You should see the "CI - Run Tests" workflow running
4. After tests complete:
   - If all tests pass: You'll receive a success email (currently enabled)
   - If any test fails: You'll receive a failure email

---

## Understanding the Workflow

### Workflow File: `.github/workflows/ci.yml`

**Trigger Events:**
```yaml
on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]
```

**Services:**
- PostgreSQL 15 (containerized) on `localhost:5432`
- Database: `phishing_test_db`
- User: `phishing_user`
- Password: `phishing_password`

**Environment Variables for Tests:**
```bash
DATABASE_URL=postgresql://phishing_user:phishing_password@localhost:5432/phishing_test_db
FLASK_ENV=testing
FLASK_CONFIG=testing
```

**Python Version:** 3.12 (matches your venv)

---

## Database Configuration

The test configuration uses PostgreSQL in the CI environment:

**Config File:** `backend/app/config.py`

**TestingConfig behavior:**
- **Local development:** Uses SQLite in-memory (`sqlite:///:memory:`)
- **CI/CD pipeline:** Uses PostgreSQL when `DATABASE_URL` is set

This is controlled by:
```python
SQLALCHEMY_DATABASE_URI = os.environ.get(
    'DATABASE_URL',
    'sqlite:///:memory:'
)
```

---

## Email Notification Configuration

### Current Setup:
- ✅ Sends email **on test failure**
- ✅ Sends email **on test success**
- Uses Gmail SMTP (smtp.gmail.com:465)

### To Disable Success Emails:
Edit `.github/workflows/ci.yml` and comment out or remove the "Send success notification" step:

```yaml
# - name: Send success notification
#   if: success()
#   uses: dawidd6/action-send-mail@v3
#   ...
```

### To Change Email Provider:
Replace the `dawidd6/action-send-mail` action with your provider's GitHub Action, or use a different SMTP server by modifying:
```yaml
server_address: smtp.your-provider.com
server_port: 465  # or 587 for TLS
```

---

## Troubleshooting

### Tests Pass Locally but Fail in CI

**Common Causes:**
1. **Environment variables not set** - Check that `DATABASE_URL` is properly set
2. **PostgreSQL not ready** - The workflow waits for PostgreSQL health check
3. **Different Python version** - CI uses Python 3.12, verify your code is compatible

**Solutions:**
1. Check the workflow logs: **Actions → [Workflow Name] → [Run]**
2. Look at the "Run tests" step output for detailed error messages
3. Run tests locally with `python -m pytest tests/ -v`

### Emails Not Being Received

**Check list:**
1. ✓ `EMAIL_USERNAME` and `EMAIL_PASSWORD` are set in GitHub Secrets
2. ✓ `EMAIL_RECIPIENTS` is set correctly (check for typos)
3. ✓ Gmail App Password is used (not regular password)
4. ✓ 2-Factor Authentication is enabled on the Gmail account
5. ✓ Check spam/promotions folder in email
6. ✓ Look at GitHub Actions logs for SMTP errors

**Gmail Troubleshooting:**
- Go to [Gmail Security](https://myaccount.google.com/security)
- Check "Less secure app access" is disabled (uses App Passwords instead)
- Regenerate App Password if issues persist

### Tests Hang or Timeout

**Likely cause:** PostgreSQL service not starting properly

**Solution:**
1. Check the workflow logs for PostgreSQL health check failures
2. Verify PostgreSQL is using port 5432 (not blocked by another service)
3. Check for typos in database credentials

---

## Running Tests Locally (For Reference)

```bash
# Using SQLite (default)
python -m pytest tests/ -v

# Using PostgreSQL (if manually started)
export DATABASE_URL=postgresql://user:password@localhost:5432/phishing_test_db
python -m pytest tests/ -v
```

---

## Next Steps

After CI is running successfully:

1. **Add status badge to README** (optional):
   ```markdown
   ![CI Pipeline](https://github.com/[owner]/[repo]/actions/workflows/ci.yml/badge.svg)
   ```

2. **Require passing CI before merge** (protection rule):
   - Go to **Settings → Branches → Branch Protection Rules**
   - Add rule for `master` branch
   - Enable "Require status checks to pass before merging"
   - Select "CI - Run Tests" as required check

3. **Consider adding:**
   - Code coverage reporting
   - Automated deployment after tests pass
   - Additional quality checks (linting, type checking)

---

## Reference

- **GitHub Actions Documentation:** https://docs.github.com/en/actions
- **Email Action Used:** https://github.com/dawidd6/action-send-mail
- **PostgreSQL Docker Image:** https://hub.docker.com/_/postgres

