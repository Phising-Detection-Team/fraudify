# Phishing Detection System

> **AI-Powered Email Security through Adversarial Training**

An intelligent email security system that uses frontier AI models in a three-agent architecture to detect phishing emails. The system employs competitive learning where a Generator creates realistic phishing emails, a Detector identifies them and continuously improving detection accuracy through offline training rounds.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Current Implementation](#current-implementation)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Multi-Agent System Details](#multi-agent-system-details)
- [Project Status](#project-status)
- [Team](#team)
- [Documentation](#documentation)

---

## 🎯 Project Overview

### Purpose

This system addresses the growing sophistication of phishing attacks by using AI models that compete against each other to generate training data and improve detection accuracy. Unlike traditional rule-based filters, this approach continuously evolves to counter new attack techniques.

### Target Users

- **Individual email users** seeking personal email protection
- **Small business employees** lacking advanced cybersecurity awareness
- **Security operations teams** needing automated threat detection

### Success Metrics

- **Detection accuracy**: >85% precision, >80% recall
- **False positive rate**: <5%
- **Detection speed**: <5 seconds per email
- **System uptime**: 99%

---

## 🚀 Current Implementation

- ✅ Successfully ran all 3 agents (Generator, Detector, Orchestration) and saved results to PostgreSQL using Docker Compose.
- 🚧 Now moving on to Redis caching and full Dockerization for backend services.
- 🧪 Next: Implementing unit tests for backend logic.
- 🖥️ Next: Starting frontend (React) dashboard development.

### Multi-Agent System (LLMs Directory)

A sophisticated multi-agent AI system using **Semantic Kernel orchestration** with AI-powered function calling where specialized agents compete in an adversarial competition.

#### 🏗️ Architecture

**Entity-Service Pattern with Optional Binding**
- **Entities**: Independent state holders (API keys, clients, configuration)
- **Services**: Flexible operation providers supporting dual-mode usage
- **Optional Binding**: Services can be bound to entities (for Semantic Kernel) or stateless (with entity parameter)
- **No Adapter Layer**: Services register directly with Semantic Kernel

#### 🎭 Agents

**1. Generator Agent (OpenAI GPT-4o)**
- **Goal**: Create highly convincing and sophisticated scam emails
- **Strategy**: Advanced psychological manipulation, authenticity engineering, subtle manipulation
- **Capabilities**:
  - Various scam types (phishing, lottery, Nigerian prince, tech support, CEO fraud)
  - Professional formatting and specific details
  - Social engineering tactics
- **Scoring**: Technical realism (0-25), psychological impact (0-25), subtlety factor (0-25), social engineering (0-25)

**2. Detector Agent (Claude Sonnet 4.5)**
- **Goal**: Detect and analyze sophisticated scam emails with comprehensive indicator analysis
- **Strategy**: Multi-layered analysis framework
  - **Layer 1**: Structural Analysis (sender, linguistics, formatting)
  - **Layer 2**: Content Analysis (urgency, information requests, financial indicators)
  - **Layer 3**: Psychological Analysis (emotional manipulation, social engineering)
  - **Layer 4**: Technical Analysis (links, attachments, anomalies)
- **Scoring**: Accuracy (0-25), analytical depth (0-25), indicator identification (0-25), reasoning quality (0-25)

**3. Orchestration Agent (OpenAI GPT-4o)**
- **Goal**: AI-powered workflow management using function calling
- **Strategy**: Automatically plans and executes the workflow
- **Capabilities**:
  - Intelligent agent coordination
  - Multi-round processing with status tracking
  - Cost calculation and performance metrics

#### Quick Start (LLMs Implementation)

```bash
cd LLMs

# Install dependencies
pip install -r requirements.txt

# Configure API keys (.env file)
cp .env.example .env
# Edit .env with your keys:
# OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here
# GOOGLE_API_KEY=your_key_here (optional, for Judge Agent)

# Run the multi-agent competition
python main.py

# You'll be prompted for:
# - Number of rounds (default: 1)
# - Number of emails per round (default: 1)
```

#### Architecture Example

```python
# Entity-Service pattern with optional binding
from entities.generator_agent_entity import GeneratorAgentEntity
from services.generator_agent_service import GeneratorAgentService

# Create entity (configuration + API client)
entity = GeneratorAgentEntity()

# Bind entity to service for Semantic Kernel
service = GeneratorAgentService(entity=entity)

# Register directly with kernel (no adapter needed)
kernel.add_plugin(service, "generator")

# Service automatically uses bound entity
result = await service.generate_scam(scenario="phishing")
```

---

## ✨ Key Features

### Two-Agent Competition System (Phase 1 - In Progress)

- **Generator Agent**: Creates synthetic phishing emails for training
- **Detector Agent**: Analyzes emails and identifies threats
- **AI Orchestration**: Semantic Kernel with function calling
- **Multi-Model Architecture**: GPT-4o, Claude Sonnet 4.5

### Real-Time Monitoring Dashboard (Phase 2 - Planned)

- Live competition round progress tracking
- WebSocket-powered instant updates
- Historical accuracy trend visualization
- Drill-down into individual email analysis
- Manual verdict override capability

### Browser Extension (Phase 3 - Future)

- Real-time email scanning for Gmail, Outlook, etc.
- Risk score overlay on emails
- Privacy-first local pre-filtering
- User consent and data protection

---

## 🏗️ System Architecture

### Three-Agent Architecture

```
┌─────────────────────┐
│ Orchestration Agent │ → AI-powered workflow management
│    (GPT-4o)         │    • Function calling coordination
└──────────┬──────────┘    • Multi-round processing
           │               • Status tracking & metrics
           ▼
┌──────────────────┐       ┌──────────────────┐
│  Generator Agent │       │  Detector Agent  │
│   (GPT-4o)       │       │ (Claude Sonnet)  │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         ▼                          ▼
   Creates phishing            Multi-layered
   emails with                 threat analysis
   metadata                    & detection

   Entity-Service Architecture:
   ┌─────────┐   Optional    ┌─────────┐
   │ Entity  │◄────Binding──►│ Service │
   │ (State) │               │ (Logic) │
   └─────────┘               └─────────┘
```

### AI-Powered Orchestration

The system uses **Semantic Kernel** for intelligent workflow management:
- Orchestrator AI automatically plans the workflow
- Function calling for agent coordination
- Async/await pattern for efficient API calls
- Safety limits to prevent infinite loops
- Multi-round support with configurable batch sizes

### Competition Round Lifecycle

1. **Initialize**: Configure rounds and emails per round
2. **Generate**: Create synthetic phishing/legitimate emails (Generator Agent)
3. **Detect**: Analyze each email for threat indicators (Detector Agent)
4. **Track**: Record API costs, token usage, and processing time
5. **Store**: Persist results in PostgreSQL (optional, configurable)
6. **Analyze**: Display metrics and insights per round

### Entity-Service Architecture

**Entities** (State Holders):
- API keys, credentials, model identifiers
- API client instances (AsyncOpenAI, AsyncAnthropic, etc.)
- Prompt access via centralized prompts.py
- **Completely independent** - no service dependency

**Services** (Operation Providers):
- Core functionality (generate, detect, orchestrate)
- API calls with error handling
- Cost/performance tracking
- **Dual-mode support**: Bound entity OR entity parameter
- Direct Semantic Kernel registration

### Technology Layers

- **Current**: Semantic Kernel orchestration with multi-model AI
- **Planned**: Flask API with Celery for async processing
- **Planned**: PostgreSQL for persistence, Redis for caching
- **Planned**: React dashboard (real-time updates via WebSocket)
- **Future**: Docker containers for deployment

---

## 🛠️ Technology Stack

### Current Implementation (LLMs)
- **Architecture**: Entity-Service pattern with optional binding
- **Orchestration**: Semantic Kernel with AI function calling
- **AI Models**:
  - OpenAI GPT-4o-mini (generation & orchestration, 128k context)
  - Anthropic Claude Sonnet 4.5 (detection & analysis)
  - Google Gemini 2.5 Flash (judging, optional)
- **Language**: Python 3.11+ with async/await
- **APIs**: OpenAI, Anthropic, Google Generative AI
- **Cost Tracking**: tokencost library for accurate pricing
- **Utilities**: Centralized prompts, API tracking, DB integration

### Backend (Planned - Flask Implementation)
- **Framework**: Flask 3.1.2
- **Task Queue**: Celery 5.6.2 with Redis
- **Database**: PostgreSQL with SQLAlchemy 2.0.46
- **Real-time**: Flask-SocketIO 5.6.0
- **Migrations**: Alembic 1.18.3

### Frontend (Planned)
- **Framework**: React with Next.js or Vite
- **Charts**: Chart.js for analytics
- **WebSocket**: Socket.IO client

### DevOps
- **Containerization**: Docker & Docker Compose (planned)
- **Version Control**: Git/GitHub
- **Testing**: pytest 9.0.2, coverage 7.13.2
- **Code Quality**: black, flake8, pylint, mypy

---

## 🚀 Getting Started

### Quick Start (Current LLMs Implementation)

```bash
# Navigate to LLMs directory
cd LLMs

# Install dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env and add your API keys:
#   OPENAI_API_KEY=your_key_here
#   ANTHROPIC_API_KEY=your_key_here
#   GOOGLE_API_KEY=your_key_here

# Run the multi-agent competition
python main.py

# Interactive prompts:
# Enter number of rounds: 3
# Enter number of emails per round: 5
```

### Example Output

```
🚀 STARTING AI-POWERED MULTI-ROUND ORCHESTRATION
   Rounds: 3
   Emails per round: 5
============================================================

📝 ROUND 1/3
============================================================
   Generating email 1/5...
   ✓ Email 1 generated and analyzed
      Generator status: ✓
      Detector status: ✓
   ...

✅ Round 1 complete: 5 emails generated
   Generator successes: 5/5
   Detector successes: 5/5
   Processing time: 42s
   Total cost: $0.0234500

============================================================
📊 AI ORCHESTRATION COMPLETE
============================================================

📊 Summary:
   Total rounds: 3
   Emails per round: 5
   Total emails generated: 15
```

### Full Stack Setup (Future Flask/React Implementation)

#### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Redis 7+
- API Keys: OpenAI, Anthropic, Google Gemini

#### Installation

```bash
# Clone the repository
git clone <repository-url>
cd phishing_detection

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
cd backend
pip install -r app/requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# Initialize database
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Start Redis server
redis-server

# Run Celery worker
celery -A app.celery worker --loglevel=info

# Run Flask application
python app/run.py
```

#### Configuration

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/phishing_detection

# Redis
REDIS_URL=redis://localhost:6379/0

# AI API Keys
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here

# Flask
FLASK_ENV=development
SECRET_KEY=your_secret_key_here
```

---

## 🧠 Multi-Agent System Details

### Scoring System

**Generator Agent (0-100)**
- **Technical Realism** [0-25]: Authenticity of technical details
- **Psychological Impact** [0-25]: Effectiveness of emotional/cognitive manipulation
- **Subtlety Factor** [0-25]: Ability to evade obvious detection patterns
- **Social Engineering** [0-25]: Quality of trust-building and persuasion tactics

**Detector Agent (0-100)**
- **Accuracy** [0-25]: Correct verdict with proper confidence level
- **Analytical Depth** [0-25]: Thoroughness and insight quality
- **Indicator Identification** [0-25]: Found key red flags vs missed indicators
- **Reasoning Quality** [0-25]: Logic, evidence, and argumentation strength

### Heterogeneous Multi-Model Architecture

This system demonstrates a **heterogeneous multi-model approach**:
- **OpenAI GPT-4o-mini**: Orchestration and generation (128k context window, cost-effective)
- **Claude Sonnet 4.5**: Advanced detection and analysis (200k context window)
- **Google Gemini 2.5 Flash**: Fast evaluation and judging (optional)

Each agent uses a different AI model optimized for its specific task.

### Configuration & Customization

**Architecture Files:**
- **entities/**: Configure API keys, models, and clients
  - `generator_agent_entity.py`: OpenAI configuration
  - `detector_agent_entity.py`: Anthropic configuration
  - `orchestration_agent_entity.py`: Workflow state
- **services/**: Modify business logic and operations
  - `generator_agent_service.py`: Email generation logic
  - `detector_agent_service.py`: Threat detection logic
  - `orchestration_agent_service.py`: Workflow coordination
- **agents/prompts.py**: Centralized prompt templates for all agents
- **utils/**: API tracking, cost calculation, database integration
- **main.py**: Entry point, configure rounds and batch size

---

## 📊 Project Status

### Current Phase: **Phase 1 - Foundation** (Weeks 1-4)

#### ✅ Completed
- Multi-agent system implementation (LLMs directory)
- Generator, Detector, Orchestration agents running and saving results to PostgreSQL via Docker Compose
- Database schema design (Email, Round, Log models)
- SQLAlchemy models with proper relationships
- Requirements.txt with comprehensive dependencies
- Project architecture documentation (LLMs/ARCHITECTURE.md)
- Detailed project scoping questionnaire

#### 🔄 In Progress
- Redis caching integration and Dockerization
- Unit testing for backend logic
- Frontend (React) dashboard setup
- Flask API setup and configuration
- Integration of LLMs agents with Flask backend
- Celery task orchestration for competition rounds
- Docker containerization

#### ⏳ Upcoming (Phase 1)
- Persistent storage of competition results in PostgreSQL
- Basic React dashboard setup
- Manual round triggering via API
- End-to-end testing
- Documentation and code comments
| **Phase 2**: Dashboard | Weeks 5-8 | ⏳ Planned | Real-time monitoring, WebSocket integration |
| **Phase 3**: User API | Weeks 9-12 | ⏳ Planned | Email scanning endpoint, caching, rate limiting |
| **Phase 4**: Extension | Weeks 13-16 | ⏳ Planned | Chrome extension, Gmail integration |
| **Phase 5+**: Enhancements | Future | 💡 Ideas | Federated learning, custom model fine-tuning |

### Project Structure

```
phishing_detection/
├── LLMs/                         
│   ├── agents/
│   │   └── prompts.py            # Centralized prompt templates
│   ├── entities/                 # State holders (API keys, clients, config)
│   │   ├── base_entity.py
│   │   ├── generator_agent_entity.py    # OpenAI configuration
│   │   ├── detector_agent_entity.py     # Anthropic configuration
│   │   └── orchestration_agent_entity.py # Workflow state
│   ├── services/                 # Operation providers (business logic)
│   │   ├── base_service.py
│   │   ├── generator_agent_service.py   # Email generation
│   │   ├── detector_agent_service.py    # Threat detection
│   │   └── orchestration_agent_service.py # Workflow coordination
│   ├── utils/                    # Utilities
│   │   ├── api_utils.py          # API tracking, cost calculation
│   │   └── db_utils.py           # Database integration
│   ├── main.py                   # Entry point (multi-round orchestration)
│   ├── ARCHITECTURE.md           # Detailed architecture documentation
│   └── .env.example              # Environment variable template
├── backend/                       # ⏳ Flask backend (planned)
│   ├── app/
│   │   ├── models/               # SQLAlchemy models
│   │   ├── routes/               # Flask routes
│   │   ├── services/             # Business logic
│   │   ├── tasks/                # Celery tasks
│   │   └── utils/                # Helper functions
│   └── requirements.txt
├── frontend/                      # ⏳ React dashboard (planned)
├── Documents/                     # 📚 Project documentation
│   ├── Project_Scope.md
│   ├── Questions.md
│   └── Project_Architecture.excalidraw
└── README.md                      # This file
```

---

## 🎯 Use Cases

- **Security Training**: Help teams recognize sophisticated scam patterns and social engineering tactics
- **AI Research**: Study adversarial AI systems and multi-agent competition
- **Educational**: Demonstrate Semantic Kernel orchestration with function calling
- **Testing**: Evaluate email security systems and detection capabilities
- **Multi-Model Integration**: Learn how to integrate different AI providers in a single system
- **Real-time Protection**: Browser extension for individual users (future)
- **Enterprise Security**: Dashboard for security operations teams (future)

---

### Development Phases

| **Phase** | **Timeline** | **Status** | **Key Deliverables** |
|-------|----------|--------|------------------|
| **Phase 1**: Foundation | Weeks 1-4 | 🔄 In Progress | ✅ Multi-agent system, 🔄 database setup |
| **Phase 2**: Dashboard | Weeks 5-8 | ⏳ Planned | Real-time monitoring, WebSocket integration |
| **Phase 3**: User API | Weeks 9-12 | ⏳ Planned | Email scanning endpoint, caching, rate limiting |
| **Phase 4**: Extension | Weeks 13-16 | ⏳ Planned | Chrome extension, Gmail integration |
| **Phase 5+**: Enhancements | Future | 💡 Ideas | Federated learning, custom model fine-tuning |

---

## 👥 Team

- **Hoang Nhat Duy Le** - Project Supervisor / Expert
- **Hoang Bao Duy Le** - Developer / Engineer
- **Thanh Dang Huynh** - Developer / Engineer
- **Thien Quy Pham** - Cybersecurity Analyst / Developer

**Team Structure**: First-time multi-person project with flexible timeline and collaborative learning focus.

---

## 📚 Documentation

- [Project Scope](Documents/Project_Scope.md) - Comprehensive specification and requirements
- [Questions & Decisions](Documents/Questions.md) - Detailed scoping questionnaire with answers
- [Architecture Diagram](Documents/Project_Architecture.excalidraw) - System architecture visualization

### Key Documentation Highlights

#### Threat Detection Scope (Priority Ordered)
1. **Priority 1**: Phishing, malware attachments, social engineering
2. **Priority 2**: Spear phishing, BEC, account takeover
3. **Priority 3**: Spam

#### Data Privacy Approach
- GDPR-compliant principles (student project)
- Encryption at rest (AES-256) and in transit (TLS 1.2+)
- User consent flow for browser extension
- 30-day data retention policy
- Clear privacy policy and ToS

#### Ethical Safeguards
- Generator is internal-only (no public access)
- Watermarking of all synthetic emails
- Admin authentication required
- Rate limiting (10 generations/hour)
- Audit logging for accountability
⚠️ Disclaimer

This system is for **educational and research purposes only**. Do not use generated scam emails for malicious purposes. The Generator Agent is designed to improve detection capabilities and security awareness training only.

---

## 🙏 Acknowledgments

- **OpenPhish & PhishTank**: Public phishing datasets
- **OpenAI**: GPT-4o-mini for generation and orchestration
- **Anthropic**: Claude Sonnet 4.5 for advanced detection
- **Google**: Gemini 2.5 Flash for evaluation
- **Microsoft**: Semantic Kernel framework
- **Flask Community**: Excellent web framework documentation

### Data Protection
- All sensitive data encrypted at rest and in transit
- API keys stored in environment variables (never committed)
- Database credentials secured via environment configuration
- Session management with secure cookies

### Responsible AI Usage
- Generator model isolated (no external network access)
- Research-only purpose documentation
- Team accountability agreement
- Regular ethical reviews

---

## 📈 Success Metrics & KPIs

### Technical Metrics
- Detection accuracy: Target >85% precision, >80% recall
- False positive rate: <5%
- Processing latency: <5 seconds per email
- System uptime: 99%

### User Metrics (Future)
- User satisfaction score (survey-based)
- Threats successfully blocked
- Alert click-through rate
- Reduction in successful attacks

---

## 🤝 Contributing

This is a student project with a closed team during active development. Post-completion, the repository will be open-sourced on GitHub with contribution guidelines.

---

## 📄 License

To be determined upon project completion.

---

##  Contact

For questions or collaboration inquiries:
- **Email**: [Contact through repository issues]
- **Project Start Date**: January 29, 2025
- **Expected Completion**: April 2025 (MVP)

---

**Status**: 🔄 Active Development | **Last Updated**: February 23, 2026
