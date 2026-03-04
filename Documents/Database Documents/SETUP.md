# Application Setup & Running

## Files Created

### 1. `backend/app/config.py`
Flask configuration for different environments (development, testing, production)

### 2. `backend/app/__init__.py`
Flask app factory with `create_app()` function that:
- Loads environment configuration
- Initializes SQLAlchemy database
- Registers all models
- Creates database tables

### 3. `backend/app/run.py`
Application entry point at app level

### 4. `backend/run.py`
Main entry point at backend level

## Quick Start

### 1. Test Database Initialization
```bash
cd phishing_detection
python test_create_app.py
```

Expected output:
```
✅ Successfully imported create_app and db
✅ Created Flask app successfully
✅ Database tables created successfully
✅ All models imported successfully

✅ CREATE_APP INITIALIZATION COMPLETE
   Database: In-memory SQLite
   Tables: Email, Round, Log, API_calls, Manual_Overrides
   Status: Ready for operations
```

### 2. Run Quick Database Security Test
```bash
python quick_test.py
```

Tests:
- Confidence range validation (0-1 only)
- Processed emails cannot exceed total
- Enum validation (status, level, agent_type, verdict)
- Negative values rejected
- Unique constraints (email_test_id)
- API agent type validation

### 3. Start Flask Server
```bash
cd backend
python run.py
```

Server runs on: `http://localhost:5000`

Or using Flask CLI:
```bash
export FLASK_APP=app
export FLASK_ENV=development
flask run
```

## Configuration

### Environment Variables

```bash
# Set Flask environment
export FLASK_ENV=development  # or testing, production

# Set database URL (optional, defaults to sqlite:///app.db for development)
export DATABASE_URL=postgresql://user:password@localhost:5432/phishing_db

# Set port (optional, defaults to 5000)
export PORT=5000

# Set secret key (required for production)
export SECRET_KEY=your-secret-key-here
```

## Database

### SQLite (Development)
Default database: `backend/app.db`

Uses SQLite in-memory for testing.

### PostgreSQL (Production)
Set `DATABASE_URL` environment variable:
```bash
export DATABASE_URL=postgresql://user:pass@host:5432/phishing_db
```

## Models

All models automatically registered and created:
- `Email` - Individual email records
- `Round` - Competition rounds
- `Log` - System logging
- `API` - API call tracking
- `Override` - Manual verdict overrides

## Testing

### Run Both Tests
```bash
python test_create_app.py && python quick_test.py
```

### Run Full Test Suite
```bash
cd backend
pytest tests/ -v
```

## Troubleshooting

### Import Error: `No module named 'app'`
Make sure you're running from the project root:
```bash
cd /path/to/phishing_detection
python test_create_app.py
```

### Database Error: `app.db not found`
This is normal - database is created automatically when app starts.

### Port Already in Use
Change the port:
```bash
cd backend
python -c "from app import create_app; app = create_app(); app.run(port=5001)"
```

## File Structure

```
backend/
├── app/
│   ├── __init__.py          (← create_app function)
│   ├── config.py            (← Configuration)
│   ├── run.py               (← App entry point)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── email.py
│   │   ├── round.py
│   │   ├── log.py
│   │   ├── api.py
│   │   └── human_override.py
│   ├── routes/
│   ├── services/
│   ├── tasks/
│   └── utils/
├── migrations/
│   └── versions/
├── run.py                   (← Backend entry point)
└── alembic.ini
```
