"""update email validation to allow username format

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-24 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Update email constraint to allow username or email format."""
    # Drop the old constraint
    op.drop_constraint('ck_user_email_format', 'users', type_='check')
    
    # Add new constraint that allows username (no @) or email format
    op.create_check_constraint(
        'ck_user_email_format',
        'users',
        "email ~ '^[a-z0-9._%+\\-]+(@[a-z0-9.-]+\\.[a-z]{2,})?$'"
    )


def downgrade() -> None:
    """Revert to email-only format."""
    # Drop the new constraint
    op.drop_constraint('ck_user_email_format', 'users', type_='check')
    
    # Restore the old constraint (email format only)
    op.create_check_constraint(
        'ck_user_email_format',
        'users',
        "email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'"
    )
