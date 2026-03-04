# Database Validation Strategy

This project uses a **three-layer validation** approach to ensure data integrity:

1. **API Input Validation (Pydantic)** – To be implemented. Will validate incoming HTTP data before it reaches models, providing fast feedback and clear errors.
2. **ORM Validation (@validates in SQLAlchemy)** – Implemented. Checks Python object assignments and business logic, raising errors before DB commit.
3. **Database Constraints (CHECK, UNIQUE, NOT NULL)** – Implemented. Enforces rules at the database level, catching invalid data even from raw SQL.

**Why it matters:**
- Prevents bad data, silent corruption, and security issues.
- Catches errors early, ensures reliable analytics, and improves debugging.

**Best Practices:**
- Use all three layers for robust protection.
- Name constraints descriptively (e.g., `ck_email_cost_nonneg`).
- Allow NULL only for optional fields.
- Validate business logic, not just types.
- Provide clear error messages.
- Test each layer (API, ORM, DB).

**Current Status:**
- ORM and DB constraints: Done (validators and constraints for all key fields).
- API validation: To be added using Pydantic schemas.

**Next Steps:**
- Implement Pydantic schemas for API validation.

**Resources:**
- SQLAlchemy: https://docs.sqlalchemy.org/
- Alembic: https://alembic.sqlalchemy.org/
- Pydantic: https://docs.pydantic.dev/

For details, see the models and migration scripts in the backend, and related tests.
