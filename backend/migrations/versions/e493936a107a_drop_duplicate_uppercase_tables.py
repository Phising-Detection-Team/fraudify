"""Drop duplicate uppercase tables

Revision ID: e493936a107a
Revises: a3ff577e8adc
Create Date: 2026-02-21 15:20:16.362571

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e493936a107a'
down_revision: Union[str, Sequence[str], None] = 'a3ff577e8adc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop duplicate UPPERCASE tables (keep lowercase ones from models)."""
    # Drop tables with foreign key dependencies first
    op.drop_table('Overrides')
    op.drop_table('manual_overrides')
    # Then drop tables they depend on
    op.drop_table('API_calls')
    op.drop_table('Emails')
    op.drop_table('Logs')
    op.drop_table('Rounds')


def downgrade() -> None:
    """Downgrade schema."""
    pass
