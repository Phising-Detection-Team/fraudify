"""Add preferred_language to users

Revision ID: c1a6f9d2b4aa
Revises: e3d15040c602
Create Date: 2026-04-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a6f9d2b4aa'
down_revision: Union[str, Sequence[str], None] = 'e3d15040c602'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('preferred_language', sa.String(length=8), nullable=False, server_default='en'),
    )
    op.execute("UPDATE users SET preferred_language = 'en' WHERE preferred_language IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'preferred_language')
