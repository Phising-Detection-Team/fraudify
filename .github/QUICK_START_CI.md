# Quick Start: GitHub Actions CI Setup

## TL;DR - 5 Minute Setup

### Step 1: Configure Email Credentials (2 minutes)

1. **Get Gmail App Password:**
   - Go to [myaccount.google.com/security](https://myaccount.google.com/security)
   - Enable 2-Factor Authentication (if not done)
   - Click "App Passwords" → Select "Mail" + "Windows Computer"
   - Copy the 16-character password

2. **Add to GitHub Secrets:**
   - Go to your repo: **Settings → Secrets and variables → Actions**
   - Click **"New repository secret"**
   - Add these 3 secrets:

   | Secret Name | Value |
   |---|---|
   | `EMAIL_USERNAME` | your-email@gmail.com |
   | `EMAIL_PASSWORD` | xxxxxxxx xxxxxxxx (16-char from Gmail) |
   | `EMAIL_RECIPIENTS` | team@example.com or team@ex.com,dev@ex.com |

### Step 2: Test the Pipeline (1 minute)

1. Create a small commit to `master` branch
2. Go to **Actions** tab in GitHub
3. See the "CI - Run Tests" workflow running
4. Wait for tests to complete
5. Check your email for notification

### Step 3: Done! ✅

The CI pipeline is now active and will automatically:
- Run tests on every push to `master`/`main`
- Run tests on every pull request
- Send email notifications on failures

---

## What's Running?

```
✓ Python 3.12
✓ PostgreSQL 15 (in Docker)
✓ All tests from tests/ directory
✓ Email notifications on failure
```

---

## If Tests Fail

**Check the logs:**
1. Go to **Actions** tab
2. Click the failed workflow run
3. Click "Run tests" step
4. See detailed error messages

**Common issues:**
- Missing environment variables
- Database connection issues
- Test data problems

**Get detailed help:**
See `.github/CI_SETUP.md` for full troubleshooting guide

---

## Files Created

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Main CI workflow definition |
| `.github/CI_SETUP.md` | Complete setup & troubleshooting guide |
| `backend/app/config.py` | Updated to support PostgreSQL in tests |

---

## Next: Require Passing Tests Before Merge (Optional)

To prevent merging code with failing tests:

1. Go to **Settings → Branches**
2. Click **Add rule** (or edit existing rule for `master`)
3. Enable: **"Require status checks to pass before merging"**
4. Select: **"CI - Run Tests"** as required check
5. Save

Now PRs can't be merged until tests pass! 🎯

---

## For Team Members

Share this with your team:

> The project now has automated testing on GitHub!
> - Tests run automatically when you push or create a PR
> - You'll get email notifications if tests fail
> - You need to set up Gmail credentials once (see `.github/CI_SETUP.md`)

---

## Rollback / Disable

If you need to temporarily disable CI:
- Comment out or delete `.github/workflows/ci.yml`
- Or go to Actions tab → Click workflow → Click "..." → "Disable workflow"

To re-enable: Uncomment/restore the file or re-enable from Actions tab.

