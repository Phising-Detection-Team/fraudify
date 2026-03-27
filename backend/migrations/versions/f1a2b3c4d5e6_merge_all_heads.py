"""Merge all migration heads into a single head.

Revision ID: f1a2b3c4d5e6
Revises: d1e2f3g4h5i6, 721e26be43f1, e4c5d6e7f8a9
Create Date: 2026-03-26 14:45:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = ('d1e2f3g4h5i6', '721e26be43f1', 'e4c5d6e7f8a9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
