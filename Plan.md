# Frontend-Backend Authentication & Data Integration

**TL;DR:** Build a stateless auth system (Users + Roles tables with bcrypt + JWT), add versioned backend endpoints (signup/login with email verification, rate limiting, request validation), connect frontend to real backend data, replace mock data with live dashboard showing model performance & training options, and enforce quality with unit/integration tests in CI.

---

## Design Principles

- **Stateless backend**: JWT-only authentication — no server-side sessions, no `Flask-Session`, no sticky sessions. Each request is self-contained; the JWT carries identity and role claims. This keeps the app small and horizontally scalable.
- **API versioning**: All routes prefixed with `/api/v1/` from day one.
- **Standardized errors**: Every error response follows `{ "error": "<code>", "message": "...", "details": [...] }`.
- **Incremental testing**: Unit and integration tests are written per phase, not deferred to the end.

---

## Steps

### Phase 1: Database Design & Schema Setup

1. Create **Users** table with columns: `id`, `email`, `username`, `password_hash`, `is_active`, `email_verified`, `created_at`, `updated_at`
2. Create **Roles** table with columns: `id`, `name` (unique — e.g. `user`, `admin`, `super_admin`), `description`, `created_at`
3. Create **UserRoles** join table with columns: `user_id` (FK to Users), `role_id` (FK to Roles), `assigned_at`, `assigned_by` (FK to Users, nullable)
4. Create **InviteCodes** table with columns: `id`, `code` (unique), `created_by` (FK to Users), `role_id` (FK to Roles — role the invite grants), `expires_at`, `used_by` (FK to Users, nullable), `used_at`, `created_at`
5. Update **Emails** table with new columns: `created_by` (FK to Users), `training_data_ingested` (boolean, default false)
6. Create **TrainingDataLogs** table for tracking training data ingestion events: `id`, `email_id` (FK), `ingested_by` (FK to Users), `action` (ingested/removed), `created_at`
7. Add dependencies to `backend/requirements.txt`: `bcrypt`, `Flask-JWT-Extended`, `Flask-Limiter`, `marshmallow` (or `pydantic`), `python-dotenv`
8. Seed the **Roles** table with initial roles: `user`, `admin`, `super_admin`
9. Create Alembic migrations for each new table (depends on 1–8)

**Phase 1 Tests:**
- Unit: Model instantiation, column constraints, FK integrity
- Migration: Verify `flask db upgrade` / `flask db downgrade` round-trips cleanly

---

### Phase 2: Backend Authentication Endpoints
*(depends on Phase 1)*

> **Stateless design:** No session store. The JWT (access + refresh token pair) is the sole authentication mechanism. Logout is handled via a Redis-backed token blacklist (keyed by `jti`, TTL = token expiry).

1. Create `backend/app/models/user.py` — User model with bcrypt password hashing
   - `set_password(password)` — hashes and stores
   - `check_password(plain_password)` — verifies against hash
   - **Password policy**: minimum 8 characters, at least one letter and one digit
2. Create `backend/app/models/role.py` — Role model
3. Create `backend/app/models/invite_code.py` — InviteCode model with expiry logic (default 7 days)
4. Create `backend/app/schemas/` — Marshmallow (or Pydantic) request/response schemas for input validation
   - `SignupSchema`: email (valid format), username (3–30 chars, alphanumeric), password (policy above)
   - `LoginSchema`: email, password
   - `InviteCodeSchema`: role to grant, optional custom expiry
5. Create `backend/app/routes/auth.py` with endpoints:
   - `POST /api/v1/auth/signup` — User self-registration (email, username, password) → assigns `user` role
   - `POST /api/v1/auth/login` — Login with email/password → returns JWT access + refresh tokens
   - `POST /api/v1/auth/logout` — Blacklists current JWT `jti` in Redis
   - `POST /api/v1/auth/refresh-token` — Issue new access token from valid refresh token
   - `POST /api/v1/auth/verify-email` — Email verification with signed token
   - `POST /api/v1/auth/admin/invite` — Generate invite code (admin/super_admin only)
   - `POST /api/v1/auth/admin/signup` — Register with invite code → assigns role specified by invite
6. Add **rate limiting** (`Flask-Limiter` + Redis):
   - `/api/v1/auth/login`: 5 requests/minute per IP
   - `/api/v1/auth/signup`: 3 requests/minute per IP
   - Global default: 60 requests/minute
7. Add **CORS** configuration — Allow `http://localhost:3000` (dev), configurable for production origins
8. Add `GET /api/v1/health` — Returns `200 OK` with DB and Redis connection status (for Docker health checks)
9. Email verification service — Send verification emails with signed, time-limited tokens
10. Create seed command `flask seed` — Populates:
    - Roles: `user`, `admin`, `super_admin`
    - Test account: `admin` / `admin@admin.com` / `admin` password (pre-hashed), assigned `super_admin` role

**Phase 2 Tests:**
- **Unit**: Password hashing/verification, JWT creation, schema validation (valid + invalid inputs), invite code generation/expiry, role assignment logic
- **Integration**: Full signup → verify-email → login → access protected route → refresh → logout → verify blacklisted token is rejected
- **Integration**: Invite code flow: admin creates invite → new user signs up with code → correct role assigned → code marked used
- **Integration**: Rate limiting triggers after threshold

---

### Phase 3: Email Integration & Permissions — *DEFERRED*
*(placeholder — see [Appendix A](#appendix-a-email-integration--permissions-plan) for full plan)*

> **Decision:** Email integration (OAuth for Gmail/Outlook, inbox reading, training consent) is deferred to a post-MVP phase. The current phishing detection pipeline uses synthetically generated emails via the Generator agent. Real inbox reading introduces OAuth token management, GDPR consent flows, and encrypted credential storage — complexity that doesn't benefit the core adversarial training loop right now.
>
> **What's deferred:**
> - `EmailPermissions` table (OAuth tokens, consent tracking)
> - OAuth 2.0 handler for Gmail/Outlook
> - Email reader service
> - Consent UI in signup/settings
>
> **Prerequisites before starting:** This plan (Phases 1–6) must be complete. See [Appendix A](#appendix-a-email-integration--permissions-plan) for the full implementation plan.

---

### Phase 4: Frontend Connection & API Integration
*(depends on Phase 2)*

1. Update `frontend/.env.local` — Add `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1`
2. Create `frontend/src/lib/api.ts` — API client for all backend calls
   - `signUp(email, username, password)`
   - `login(email, password)`
   - `logout()`
   - `refreshToken()`
   - `getRounds()`
   - `getEmails()`
   - Centralized error handling (parse standardized error format)
   - Store JWT in `HttpOnly` cookie or `sessionStorage`
3. Update `auth.ts`
   - Replace mock `CredentialsProvider` with backend API calls
   - Connect to `/api/v1/auth/login` endpoint
   - Store backend-returned JWT
4. Update `middleware.ts`
   - Remove TODO bypass
   - Implement proper route protection based on JWT
   - Redirect unauthenticated users to login
5. Create login/signup pages (replace mock auth)
   - `page.tsx` — Updated login with email field
   - `frontend/src/app/signup/page.tsx` — New signup page
   - Admin signup variant with invite code field

**Phase 4 Tests:**
- **Unit**: API client functions (mock server responses), auth state management
- **Integration**: Frontend login → receives JWT → accesses protected route → token refresh → logout

---

### Phase 5: Dashboard Data & UI Updates
*(depends on Phase 4)*

1. Replace mock data in dashboard components:
   - `page.tsx` — Fetch real data from backend
   - `frontend/src/app/dashboard/admin/page.tsx` — Fetch all rounds + add account management
2. Create `frontend/src/app/dashboard/profile/page.tsx`
   - User profile management (email, username, password change)
3. Create admin account management page
   - List all users (admins-only view)
   - Create new accounts (manual + invite code)
   - View admin invite codes and their status
   - Deactivate/delete accounts
4. Replace API cost metrics with model metrics:
   - Remove API cost calculations
   - Add "Model Status" card (active/inactive, last updated)
   - Add "Model Performance" card (accuracy, precision, recall from latest round)
   - Add "Recent Logs" widget (training/detection events)
5. Add training data management section:
   - Show "Data for Training" card with count of emails available
   - "Training Data Log" — Shows ingestion events and training history
6. Add "Model Training" admin panel (admin-only)
   - View training data pipeline status
   - Trigger manual retraining
   - View training logs

**Phase 5 Tests:**
- **Unit**: Dashboard component rendering with mock data, role-based UI visibility
- **Integration**: Admin sees admin panel, regular user does not; dashboard displays real backend data

---

### Phase 6: Testing, Seed Data & CI Pipeline
*(depends on Phases 2–5)*

1. Finalize `flask seed` CLI command — Populate test data:
   - Test account: `admin` / `admin@admin.com` / `admin` (super_admin role)
   - 2–3 regular test users with `user` role
   - Mock rounds linked to test accounts
   - Sample emails for training data display
2. End-to-end test suite:
   - Signup → email verify → login → JWT → access dashboard → logout
   - Role-based access control: user vs admin vs super_admin
   - Invite code lifecycle: create → use → verify expired code rejected
3. Create `docker-compose.test.yml` — Spins up PostgreSQL + Redis for integration tests
4. CI/CD pipeline (GitHub Actions or equivalent):
   - **On every push/PR:**
     - Lint check (`ruff` or `flake8`)
     - Unit tests (`pytest -m unit`)
     - Integration tests (`pytest -m integration`) against Dockerized DB/Redis
     - Frontend tests (`npm test`)
   - **Gate merges** on all tests passing + minimum 80% coverage
   - **Optional**: type checking (`mypy`)
5. Keep existing mock data alongside real data (separate table entries for backward compatibility)

---

## Relevant Files

| File | Purpose |
|------|---------|
| `backend/requirements.txt` | Add `bcrypt`, `Flask-JWT-Extended`, `Flask-Limiter`, `marshmallow`, `python-dotenv` |
| `backend/app/models/` | Create `user.py`, `role.py`, `invite_code.py`, `training_data_log.py` |
| `backend/app/schemas/` | New directory — Marshmallow request/response validation schemas |
| `backend/app/routes/auth.py` | New file for all auth endpoints (`/api/v1/auth/*`) |
| `backend/app/routes/health.py` | New file for health check endpoint |
| `backend/app/config.py` | Add JWT secret, Redis URL, rate limit config, CORS origins |
| `frontend/src/lib/api.ts` | New API client |
| `frontend/src/app/signup/page.tsx` | New signup page |
| `auth.ts` | Connect to backend instead of mock |
| `middleware.ts` | Proper JWT-based route protection |
| `dashboard/` | Update all dashboard pages to fetch real data |
| `docker-compose.test.yml` | Test infrastructure (PostgreSQL + Redis) |
| `.github/workflows/ci.yml` | CI pipeline config (lint + test + coverage gate) |

---

## Verification

1. `flask db upgrade` creates Users, Roles, UserRoles, InviteCodes, TrainingDataLogs tables
2. `flask db downgrade` reverses cleanly
3. `flask seed` populates roles and test account
4. Backend auth endpoints:
   - `POST /api/v1/auth/signup` → user created in DB with hashed password, assigned `user` role
   - `POST /api/v1/auth/login` with `admin@admin.com` / `admin` → returns JWT access + refresh tokens
   - `POST /api/v1/auth/logout` → token blacklisted, subsequent requests with that token return `401`
   - `POST /api/v1/auth/admin/invite` → generates invite code with role and expiry
   - `POST /api/v1/auth/admin/signup` with valid invite code → user created with correct role, code marked used
   - Expired/used invite codes are rejected
5. Rate limiting: 6th login attempt within 1 minute returns `429 Too Many Requests`
6. `GET /api/v1/health` returns `200` with `{ "db": "ok", "redis": "ok" }`
7. Frontend signup/login:
   - Sign up new user → receive email verification → login works
   - Admin login with `admin@admin.com` / `admin` → redirects to admin dashboard
8. Dashboard loads real data from backend (rounds, emails, model metrics)
9. Admin can view account management, create users, generate invite codes
10. Regular user cannot access admin endpoints or admin UI
11. All tests pass: `pytest` (unit + integration), frontend tests, lint
12. CI pipeline gates PR merges on passing tests + 80% coverage

---

## Decisions & Scope

- **Stateless**: JWT-only auth with Redis-backed token blacklist for logout; no server-side sessions
- **Roles**: Many-to-many Users ↔ Roles via UserRoles join table; extensible without schema changes
- **Invite codes**: Expire after 7 days; specify which role the invite grants; tracked usage
- **Email integration**: Deferred to post-MVP (see [Appendix A](#appendix-a-email-integration--permissions-plan))
- **Password policy**: Minimum 8 characters, at least one letter and one digit
- **API versioning**: `/api/v1/` prefix on all routes
- **Rate limiting**: Login (5/min), signup (3/min), global (60/min)
- **Mock data**: Kept in DB; test account accesses it; real accounts see their own data
- **API costs**: Removed from dashboard; replaced with model status/performance metrics
- **Testing**: Incremental per phase; CI gates on lint + tests + 80% coverage

---

---

## Appendix A: Email Integration & Permissions Plan
*(to be executed after Phases 1–6 are complete)*

> This is the full plan for integrating real email inbox reading (Gmail/Outlook) with user consent and training data opt-in. It was deferred from the main plan because the core adversarial training loop uses synthetically generated emails and does not yet require real inbox access.

### Prerequisites

- Phases 1–6 of this plan are complete and deployed
- OAuth credentials obtained: Google Cloud Console (Gmail API) and Azure AD (Outlook/Microsoft Graph)
- Environment variables configured: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

### Step 1: Database Schema

1. Create **EmailPermissions** table:
   - `id` (PK)
   - `user_id` (FK to Users)
   - `email_provider` — enum: `gmail`, `outlook`
   - `access_token` — encrypted at rest (AES-256 via `cryptography` library)
   - `refresh_token` — encrypted at rest
   - `scope` — enum: `read`, `read_and_train`
   - `consent_given_at` (timestamp)
   - `revoked_at` (timestamp, nullable — null means active)
   - `created_at`, `updated_at`
2. Add column to **Emails** table: `user_consented_for_training` (boolean, default false)
3. Create Alembic migration

### Step 2: OAuth Handler

1. Create `backend/app/utils/oauth_handler.py`
   - `GmailOAuthHandler` — wraps `google-auth-oauthlib` for Gmail API
     - `get_authorization_url(user_id, scope)` → returns redirect URL + state token
     - `handle_callback(code, state)` → exchanges code for tokens, stores encrypted in DB
     - `refresh_access_token(permission_id)` → refreshes expired token
   - `OutlookOAuthHandler` — wraps `azure-identity` / MSAL for Microsoft Graph
     - Same interface as Gmail handler
   - Factory: `get_oauth_handler(provider: str)` → returns correct handler
2. Token encryption: Use `cryptography.fernet` with a key stored in env vars (`EMAIL_TOKEN_ENCRYPTION_KEY`)

### Step 3: Email Reader Service

1. Create `backend/app/services/email_reader.py`
   - `read_emails(user_id, provider, limit=50, since=None)` — reads from user's inbox
   - Extracts: subject, body (plain text), sender, recipients, timestamp, headers
   - Returns normalized `EmailData` objects regardless of provider
   - Handles token refresh automatically if access token is expired
2. Rate limit email reads: max 100 emails/hour per user

### Step 4: API Endpoints

1. `POST /api/v1/email/connect` — Initiates OAuth flow
   - Body: `{ "provider": "gmail" | "outlook", "scope": "read" | "read_and_train" }`
   - Returns: `{ "redirect_url": "https://accounts.google.com/..." }`
2. `GET /api/v1/email/callback` — OAuth callback (handles code exchange)
   - Stores encrypted tokens in EmailPermissions
   - Redirects to frontend settings page with success/error status
3. `GET /api/v1/email/permissions` — List user's connected email accounts + consent status
4. `DELETE /api/v1/email/permissions/:id` — Revoke access (sets `revoked_at`, deletes tokens)
5. `PATCH /api/v1/email/permissions/:id` — Update scope (e.g., upgrade from `read` to `read_and_train`)
6. `GET /api/v1/email/inbox` — Read emails from connected account (requires active permission)
7. `POST /api/v1/email/ingest-training` — Admin endpoint to ingest consented emails into training pipeline

### Step 5: Consent UI

1. Add to `frontend/src/app/dashboard/profile/page.tsx`:
   - "Connected Email Accounts" section
   - "Connect Gmail" / "Connect Outlook" buttons → trigger OAuth redirect
   - Per-connection: show provider, scope, connected date, revoke button
   - Training consent toggle per connection
2. Add to `frontend/src/app/signup/page.tsx` (optional):
   - Post-signup prompt: "Connect your email to help improve phishing detection?"
   - Skip option clearly visible — must not be required

### Step 6: Training Data Pipeline Integration

1. When `scope = read_and_train` and user has active consent:
   - Emails read via `email_reader.py` are flagged as `user_consented_for_training = true`
   - Admin can trigger bulk ingestion via `/api/v1/email/ingest-training`
   - Each ingestion event logged in `TrainingDataLogs` table
2. If user revokes consent:
   - Set `revoked_at` on EmailPermissions
   - Delete stored tokens
   - Mark related emails as `user_consented_for_training = false`
   - Do **not** remove already-ingested training data (log the revocation event)

### Step 7: Testing

- **Unit**: OAuth URL generation, token encryption/decryption, email normalization, consent flag logic
- **Integration**: Full OAuth flow with mocked provider responses, token refresh, revocation cleanup
- **Security**: Verify tokens are encrypted in DB, revoked permissions block access, expired tokens trigger refresh

### Dependencies to Add

```
google-auth-oauthlib>=1.2.0
google-api-python-client>=2.100.0
azure-identity>=1.15.0
msgraph-sdk>=1.0.0
cryptography>=41.0.0
```

### Relevant Files

| File | Purpose |
|------|---------|
| `backend/app/models/email_permission.py` | EmailPermissions model with encrypted token fields |
| `backend/app/utils/oauth_handler.py` | OAuth 2.0 handlers for Gmail + Outlook |
| `backend/app/services/email_reader.py` | Provider-agnostic inbox reader |
| `backend/app/routes/email.py` | Email integration endpoints (`/api/v1/email/*`) |
| `backend/app/schemas/email.py` | Request/response schemas for email endpoints |
| `frontend/src/app/dashboard/profile/page.tsx` | Connected accounts UI + consent toggles |