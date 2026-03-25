"""Merge migration branches

Revision ID: a3ff577e8adc
Revises: 7c6fa66edefb, ca864f75f53b
Create Date: 2026-02-21 15:20:01.299881

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3ff577e8adc'
down_revision: Union[str, Sequence[str], None] = ('7c6fa66edefb', 'ca864f75f53b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
