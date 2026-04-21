# Sentra — AI-Powered Phishing Detection System

> **Adversarial AI Email Security with a Full-Stack Dashboard**

Sentra is an end-to-end phishing detection platform that uses frontier AI models in a two-agent adversarial pipeline to generate synthetic phishing emails and continuously train a detector. A production-grade Flask API, Next.js dashboard, and browser-extension infrastructure back the system.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [What's Built](#whats-built)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Multi-Agent Pipeline](#multi-agent-pipeline)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Development Phases](#development-phases)
- [Team](#team)
- [Documentation](#documentation)

---

## 🎯 Project Overview

### Purpose

Phishing attacks grow more sophisticated every year. Sentra combats this by pitting two AI models against each other in training rounds: a **Generator** (Google Gemini) crafts convincing phishing and legitimate emails, and a **Detector** (Anthropic Claude) identifies them. Results are stored, analysed in a dashboard, and — eventually — used to fine-tune a smaller on-device model for the browser extension.

### Target Users

- **Individual email users** who install the Sentra browser extension
- **Security operations teams** who manage detection rounds from the admin dashboard
- **Researchers** studying adversarial AI systems and multi-agent architectures

### Success Metrics

- **Detection accuracy**: >85% precision, >80% recall
- **False positive rate**: <5%
- **Detection speed**: <5 seconds per email
- **System uptime**: 99%

---

## 🚀 What's Built

All items below are **fully implemented and running** in the current codebase.

### Backend (Flask)
- ✅ JWT authentication with access tokens, Redis blocklist, and session-expiry handling
- ✅ Role-based access control (`admin` / `user`) enforced on every protected route
- ✅ Full CRUD for Rounds, Emails, API Calls, Logs, Overrides
- ✅ User management: registration, login, password change, forgot/reset-password (Flask-Mail)
- ✅ Email verification flow (`send-verification`, token/code verify) with Resend delivery
- ✅ Post-verification welcome email with shared HTML/CSS templates and dark/light rendering support
- ✅ Invite-code based registration — regular users never see the mechanism
- ✅ Browser extension instance registration and tracking
- ✅ User-specific email scanning: `POST /api/scan` (synchronous, 1–5 s) + `GET /api/scan/history`
- ✅ Admin view of all user scans: `GET /api/scan/admin/recent` (paginated, role-protected)
- ✅ Dashboard stats include both round-based emails and user extension scans
- ✅ Per-model API cost breakdown: `GET /api/stats/costs`
- ✅ Rate limiting on auth endpoints (Flask-Limiter + Redis)
- ✅ Database seeding with admin + regular user test accounts
- ✅ Full Alembic migration history

### Frontend (Next.js 14 App Router)
- ✅ Dark-mode dashboard with Tailwind CSS and `framer-motion` animations
- ✅ NextAuth.js credential-based auth with JWT session
- ✅ **Admin dashboard**: stats cards, round management, live feed, system logs, users panel, extension instances, settings
- ✅ **Recent User Scans** table on admin dashboard — paginated, clickable rows open Framer Motion modal with full email body + detector reasoning
- ✅ **User dashboard**: onboarding checklist, extension setup guide, scan email form + history, profile settings
- ✅ Round detail page with clickable email rows → full-content dialog (subject, body, detector reasoning, ground truth)
- ✅ API Cost Breakdown pie chart fetching live per-model cost data
- ✅ Active Agents panel with live call counts, cost, and relative-time last-active
- ✅ Session-expiry toast + auto-redirect to login
- ✅ Rate-limit (429) feedback toast
- ✅ Invite-link copy button for admins (generates a signed invite code, builds `?invite=` URL)

### Browser Extension
- ✅ Gmail + Outlook content scripts — inject verdict banner above email body
- ✅ Synchronous scan path — banner transitions from "Analyzing…" → verdict in 1–5 s without polling
- ✅ Graceful error state ("Analysis unavailable") if the backend is unreachable
- ✅ Auth bridge (`sentra_bridge.js`) — syncs JWT token from Next.js to extension storage
- ✅ Popup for login status + manual token management

### Infrastructure
- ✅ `start.sh` — one-command startup script (Docker, migrations, Flask, Celery worker, Next.js)
- ✅ Docker Compose for PostgreSQL 16 + Redis 7
- ✅ 250+ backend unit and integration tests (pytest)

---

## 🏗️ System Architecture

### High-Level Diagram

```
Browser / Extension
        │  HTTPS
        ▼
┌───────────────────┐
│  Next.js Frontend │  ← NextAuth sessions, role-based routing
│  (port 3000)      │
└────────┬──────────┘
         │  REST API (JWT Bearer)
         ▼
┌───────────────────┐
│  Flask Backend    │  ← Blueprints: auth, rounds, emails, stats,
│  (port 5000)      │     scan, extension, users, logs, agents
└────┬──────────────┘
     │
     ├── PostgreSQL 16  (primary persistence)
     └── Redis 7        (JWT blocklist, rate limiting)

Admin trigger "Run Round"
         │
         ▼
┌─────────────────────────────────────┐
│  OpenAI Agents SDK + LiteLLM       │
│  openai-agentic/                    │
│                                     │
│  ┌─────────────────┐               │
│  │ Generator Agent  │ Gemini 2.0 Flash — creates phishing/legit emails  │
│  └────────┬────────┘               │
│           │ email content           │
│  ┌────────▼────────┐               │
│  │ Detector Agent   │ Claude 3.5 Haiku — verdict + reasoning + score  │
│  └────────┬────────┘               │
│           │ results persisted       │
└───────────▼─────────────────────────┘
       PostgreSQL (emails, api_calls)
```

### Competition Round Lifecycle

1. **Create** — Admin creates a round (N emails target)
2. **Run** — Backend spawns background thread; OpenAI Agents SDK orchestrates parallel Generate → Detect workflows
3. **Persist** — Each email result (verdict, confidence, reasoning, cost, latency) is written to `emails` and `api_calls` tables
4. **Monitor** — Dashboard polls round status and streams recent logs
5. **Review** — Admin drills into a round to read each email body and detector reasoning in a detail dialog
6. **Override** — Admin can manually correct any verdict; round accuracy is recalculated

---

## 🛠️ Technology Stack

### AI Pipeline

| Component | Technology |
|---|---|
| Generator model | Google Gemini 2.0 Flash (`gemini/gemini-2.0-flash`) |
| Detector model | Anthropic Claude 3.5 Haiku (`anthropic/claude-3-5-haiku-20241022`) |
| Orchestration | OpenAI Agents SDK + LiteLLM (multi-model routing) |
| Parallel execution | `asyncio.gather` — N parallel workflows per round |

### Backend

| Component | Technology |
|---|---|
| Framework | Flask 3.x with blueprints |
| Auth | Flask-JWT-Extended (access token only; expiry = session signout) |
| ORM | SQLAlchemy 2.x + Flask-SQLAlchemy |
| Migrations | Alembic |
| Email | Flask-Mail (password reset) + Resend (verification + welcome) |
| Rate limiting | Flask-Limiter + Redis |
| Testing | pytest, pytest-flask, factory_boy (237+ tests) |

### Frontend

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js (credentials provider) |
| Styling | Tailwind CSS, custom CSS variables |
| Animation | Framer Motion |
| Charts | Recharts (pie chart, responsive containers) |
| Toast | Sonner |
| Icons | Lucide React |

### Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL 16 (Docker) |
| Cache / blocklist | Redis 7 (Docker) |
| Containerisation | Docker Compose |
| Startup | `start.sh` (bash, one command) |

---

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ and npm
- Python 3.11+ with `venv`
- API keys: **Google (Gemini)** and **Anthropic (Claude)** — required to run detection rounds

### One-Command Startup

```bash
git clone <repository-url>
cd phishing_detection

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — the required keys are:
#   ANTHROPIC_API_KEY, GOOGLE_API_KEY (or GEMINI_API_KEY)
#   SECRET_KEY, JWT_SECRET_KEY
#   Optional: MAIL_SERVER/MAIL_USERNAME/MAIL_PASSWORD for password reset

# Start everything (Docker services, migrations, Flask, Next.js)
./start.sh

# Skip DB seeding on subsequent runs
./start.sh --no-seed
```

`start.sh` automatically:
1. Starts PostgreSQL and Redis via Docker Compose
2. Creates and activates a Python virtual environment
3. Installs Python dependencies
4. Runs `flask db upgrade` (all migrations)
5. Seeds the database (admin user + demo regular user) unless `--no-seed`
6. Starts the Flask backend (port 5000)
7. Installs frontend npm packages if needed and starts Next.js dev server (port 3000)

Open **http://localhost:3000** — you will be redirected to the login page.

### Default Seed Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@sentra.ai` | `admin123` |
| User | `user@sentra.ai` | `user123` |

### Key Environment Variables

```env
# Flask
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_here
FLASK_ENV=development

# Database / Redis (defaults match Docker Compose)
DEV_DATABASE_URL=postgresql://phishing_user:phishing_password@localhost:5432/phishing_db
REDIS_URL=redis://localhost:6379/0

# AI models (required for running rounds)
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Frontend URL (used in password-reset, verification, and welcome email links)
FRONTEND_URL=http://localhost:3000

# Email (optional — for password reset)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_DEFAULT_SENDER=your_email@gmail.com

# Resend (required for verification + welcome email delivery)
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=SentraAI <noreply@sentra.quest>
```

### Running Tests

```bash
cd backend
source ../venv/bin/activate
pytest ../tests/ -v
```

---

## 🧠 Multi-Agent Pipeline

### OpenAI Agents SDK Implementation (`openai-agentic/`)

This is the **active production implementation** used when an admin triggers a round.

#### Generator Agent — Google Gemini 2.0 Flash

- Randomly creates phishing (50%) or legitimate (50%) emails
- Output: structured JSON with `subject`, `body`, `is_phishing`, and email metadata
- Temperature: 0.8 (high creativity)
- Prompt enforces strict JSON output to prevent parsing failures

#### Detector Agent — Anthropic Claude 3.5 Haiku

- Analyses each email across 11 phishing-indicator dimensions
- Output: strict JSON `{ "verdict": "phishing"|"legitimate", "confidence": 0-1, "scam_score": 0-100, "reasoning": "..." }`
- Temperature: 0.3 (consistent, analytical)
- Prompt enforces JSON-only responses (no markdown, no extra text)

#### Orchestrator (`openai-agentic/main.py`)

- Pure Python async — no LLM cost for coordination
- Divides email workload across N parallel `asyncio` workflows
- Persists every result to PostgreSQL via the Flask app context
- Logs API cost and latency per call to the `api_calls` table

### Semantic Kernel Implementation (`LLMs/`)

An earlier implementation using **Semantic Kernel** with GPT-4o (orchestration/generation) and Claude Sonnet (detection). It remains in the repository as a reference implementation. See the `LLMs/` directory for its README-style comments and `main.py` entry point.

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <access_token>` except `/api/auth/signup`, `/api/auth/login`, `/api/auth/send-verification`, `/api/auth/verify-email`, `/api/auth/forgot-password`, and `/api/auth/reset-password`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register (public) |
| POST | `/api/auth/admin/signup` | Register with invite code |
| POST | `/api/auth/send-verification` | Send or resend verification email (public) |
| POST | `/api/auth/verify-email` | Verify email via token or 6-digit code; returns JWT pair |
| POST | `/api/auth/login` | Login → access token |
| POST | `/api/auth/logout` | Blocklist token |
| GET | `/api/auth/me` | Current user profile |
| PUT | `/api/auth/me/password` | Change password |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Confirm token + set new password |
| POST | `/api/auth/admin/invite` | Generate invite code (admin only) |

### Rounds

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rounds` | List rounds (paginated, filterable) |
| POST | `/api/rounds` | Create round (admin) |
| GET | `/api/rounds/<id>` | Round detail + live accuracy |
| POST | `/api/rounds/<id>/run` | Trigger AI orchestration (admin) |
| GET | `/api/rounds/<id>/emails` | Emails in a round (paginated) |

### Emails & Overrides

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emails/<id>` | Full email + API calls + override |
| POST | `/api/emails/<id>/override` | Manual verdict correction (admin) |

### Stats & Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Aggregated dashboard stats |
| GET | `/api/stats/costs` | Per-model API cost breakdown |
| GET | `/api/agents` | Agent list with live usage stats |

### User Scan

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scan` | Submit email for synchronous phishing analysis (returns verdict immediately) |
| GET | `/api/scan/status/<job_id>` | Legacy: poll async task status (kept for backward compat) |
| GET | `/api/scan/history` | User's scan history (paginated) |
| GET | `/api/scan/admin/recent` | All user scans (admin only, paginated) |

### Extension

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/extension/register` | Register browser instance |
| GET | `/api/extension/instances` | Current user's instances |
| GET | `/api/extension/instances/all` | All instances (admin) |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users (admin) |
| GET | `/api/logs` | Recent system logs (paginated) |

---

## 📁 Project Structure

```
phishing_detection/
├── start.sh                          # ✅ One-command startup script
├── .env.example                      # Environment variable template
├── requirements.txt                  # Python dependencies
├── docker-compose.yml                # PostgreSQL 16 + Redis 7
│
├── backend/
│   ├── run.py                        # Flask entry point
│   └── app/
│       ├── __init__.py               # App factory (blueprints, extensions)
│       ├── config.py                 # Dev / Test / Prod configs
│       ├── errors.py                 # Global error handlers
│       ├── commands.py               # flask seed CLI command
│       ├── models/
│       │   ├── user.py               # User + password reset fields
│       │   ├── role.py               # Role model
│       │   ├── invite_code.py        # Invite code model
│       │   ├── round.py              # Competition round
│       │   ├── email.py              # Generated email + detector output
│       │   ├── api.py                # API call log (cost, latency, tokens)
│       │   ├── log.py                # System log entries
│       │   ├── override.py           # Manual verdict overrides
│       │   ├── extension_instance.py # Browser extension registrations
│       │   ├── user_scan.py          # User-submitted scans
│       │   └── training_data_log.py  # Training pipeline ingestion log
│       ├── routes/
│       │   ├── auth.py               # Auth + email verification + invite + password reset
│       │   ├── rounds.py             # Round management
│       │   ├── emails.py             # Email detail + overrides
│       │   ├── stats.py              # Stats + cost breakdown + agents
│       │   ├── logs.py               # System logs
│       │   ├── extension.py          # Extension instance management
│       │   ├── users.py              # Admin user management
│       │   └── scan.py               # User-facing scan endpoint
│       ├── services/
│       │   ├── email_sender.py       # Resend welcome sender + shared email template rendering
│       │   ├── email_verification_service.py  # Verification email sender (token/code)
│       │   └── openai_orchestration_runner.py  # Round execution thread
│       ├── templates/email/
│       │   ├── sentra_document.html  # Shared email HTML shell
│       │   ├── sentra_theme.css      # Shared email theme (light/dark)
│       │   ├── verification_inner.html  # Verification email body
│       │   └── welcome_inner.html    # Welcome email body
│       └── utils/
│           └── helpers.py            # paginate(), require_role()
│
├── openai-agentic/                   # ✅ Active AI pipeline
│   ├── entities/
│   │   ├── generator_agent_entity.py # Gemini 2.0 Flash config
│   │   └── detector_agent_entity.py  # Claude 3.5 Haiku config
│   ├── services/
│   │   ├── generator_agent_service.py
│   │   └── detector_agent_service.py
│   ├── utils/
│   │   ├── prompts.py                # Strict JSON prompt templates
│   │   └── db_utils.py               # Flask app context integration
│   └── main.py                       # CLI + parallel workflow orchestrator
│
├── LLMs/                             # Reference: Semantic Kernel implementation
│   ├── entities/
│   ├── services/
│   ├── utils/
│   └── main.py
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── login/                # Login page (session-expiry banner)
│       │   ├── signup/               # Signup (invite-code aware)
│       │   ├── forgot-password/      # Forgot password form
│       │   ├── reset-password/       # Reset password (token from email)
│       │   ├── extension/            # Browser extension marketing page
│       │   ├── auth/callback/        # OAuth callback handler
│       │   └── dashboard/
│       │       ├── layout.tsx        # Sidebar + Toaster + session wiring
│       │       ├── admin/
│       │       │   ├── page.tsx      # Admin overview (stats + rounds + logs)
│       │       │   ├── rounds/       # Round list + [id] detail w/ email dialog
│       │       │   ├── feed/         # Live extension feed (admin)
│       │       │   ├── team/         # Users panel + invite-link button
│       │       │   ├── training/     # Training pipeline viewer
│       │       │   └── settings/     # Admin settings + extension instances
│       │       └── user/
│       │           ├── page.tsx      # User home (onboarding + stats)
│       │           ├── scan/         # Email scan form + history table
│       │           ├── settings/     # Profile settings + password change
│       │           ├── feed/         # User live feed (read-only)
│       │           └── training/     # Training viewer
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── RoundDetail.tsx       # Round detail + email content dialog
│       │   ├── ProfileSettings.tsx
│       │   ├── ExtensionPopup.tsx    # Browser extension preview
│       │   └── dashboard/
│       │       ├── StatCard.tsx
│       │       ├── RoundTable.tsx
│       │       ├── CostPieChart.tsx  # Self-fetching pie chart (per-model costs)
│       │       ├── AgentLogsTable.tsx # Agent cards with cost + relative time
│       │       ├── RecentLogsSection.tsx
│       │       └── LiveFeed.tsx
│               ├── components/admin/
│       │   └── RecentScansTable.tsx  # Admin recent-scans table + modal
│       └── lib/
│           ├── admin-api.ts          # Admin API functions + getCostBreakdown + getAdminRecentScans
│           ├── user-api.ts           # User API functions + scanEmail
│           ├── api-fetch.ts          # Shared fetch wrapper (401/429 handling)
│           └── config.ts             # API base URL + route constants
│
├── extension/
│   ├── content_scripts/
│   │   ├── gmail.js                  # Gmail DOM observer + synchronous scan + verdict overlay
│   │   └── outlook.js                # Outlook DOM observer + synchronous scan + verdict overlay
│   ├── utils/api.js                  # scanEmail, pollScanResult (legacy), registerInstance
│   ├── background/service-worker.js  # Chrome service worker (token storage, install handler)
│   ├── content_scripts/sentra_bridge.js  # JWT bridge from Next.js → extension storage
│   └── tests/                        # Jest tests for extension scripts
│
├── tests/                            # ✅ 250+ backend tests
│   ├── conftest.py                   # pytest fixtures (app, client, tokens)
│   ├── test_models.py
│   ├── test_models_auth.py
│   ├── test_models_extension.py
│   ├── test_routes_auth.py
│   ├── test_routes_rounds.py
│   ├── test_routes_emails.py
│   ├── test_routes_stats.py          # Updated: includes UserScan count assertions
│   ├── test_routes_scan.py           # Scan status 500-fix + admin/recent auth tests
│   ├── test_routes_costs.py
│   ├── test_routes_logs.py
│   ├── test_routes_extension.py
│   ├── test_routes_users.py
│   ├── test_api_utils.py
│   ├── test_db_utils.py
│   └── test_openai_orchestrator_smoke.py
│
└── Documents/
    ├── Project_Scope.md
    ├── Implementation_Plan.md
    └── Project_Architecture.excalidraw
```

---

## 📊 Development Phases

| Phase | Focus | Status | Key Deliverables |
|-------|-------|--------|-----------------|
| **Phase 1**: Foundation | AI pipeline + backend | ✅ Complete | OpenAI Agents SDK pipeline, Flask API, PostgreSQL schema, Alembic migrations, 250+ tests |
| **Phase 2**: Dashboard | Admin UI | ✅ Complete | Next.js dashboard, round management, live logs, API cost pie chart, agent stats |
| **Phase 3**: User Features | Auth + scanning | ✅ Complete | JWT auth, password reset, invite codes, synchronous user scan + history, session expiry UX |
| **Phase 4**: Extension Tracking | Browser extension infra | ✅ Complete | Gmail/Outlook content scripts, synchronous verdict banner, auth bridge, instance registration |
| **Phase 5**: Admin Visibility | Recent scans + dashboard | ✅ Complete | Admin recent-scans table + modal, stats UserScan counts, scan status 500-fix |
| **Phase 6**: Fine-tuning | On-device model | 🔄 Planned | LoRA/QLoRA fine-tune on round data, browser extension on-device inference |

---

## 👥 Team

- **Hoang Nhat Duy Le** — Project Supervisor / Expert
- **Hoang Bao Duy Le** — Developer / Engineer
- **Thanh Dang Huynh** — Developer / Engineer
- **Thien Quy Pham** — Cybersecurity Analyst / Developer

---

## 📚 Documentation

- [Project Scope](Documents/Project_Scope.md) — Comprehensive specification and requirements
- [Architecture Diagram](Documents/Project_Architecture.excalidraw) — System architecture (Excalidraw)

### Ethical Safeguards

- The Generator agent is **internal-only** (admin dashboard only; no public API)
- All generated emails are watermarked as synthetic training data
- Admin authentication required to trigger any round
- Rate limiting on all auth endpoints (10 req/min login, 5 req/min forgot-password)
- Full audit logging via the `api_calls` and `logs` tables

> ⚠️ **Disclaimer**: This system is for educational and research purposes only. Generated phishing emails are synthetic training data and must not be used for malicious purposes.

---

## 🙏 Acknowledgments

- **Anthropic** — Claude 3.5 Haiku for phishing detection
- **Google** — Gemini 2.0 Flash for email generation
- **OpenAI** — OpenAI Agents SDK for agentic workflow orchestration
- **BerriAI** — LiteLLM for multi-model routing
- **Microsoft** — Semantic Kernel (reference implementation in `LLMs/`)
- **Flask Community** — Flask, Flask-JWT-Extended, Flask-Mail, Flask-Limiter
- **Vercel** — Next.js framework

---

**Status**: ✅ Full-Stack MVP + Extension Complete | **Last Updated**: April 20, 2026
