"""email_verification_update

Revision ID: e6f7a8b9c0d1
Revises: 8949947d9621
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, Sequence[str], None] = 'b2f4c9d1e3a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_verifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index('ix_email_verifications_user_id', 'email_verifications', ['user_id'])
    op.create_index('ix_email_verifications_token', 'email_verifications', ['token'])
    op.create_index('ix_email_verifications_code', 'email_verifications', ['code'])

    op.execute("UPDATE users SET email_verified = FALSE WHERE email_verified IS NULL")
    op.alter_column(
        'users', 'email_verified',
        existing_type=sa.Boolean(),
        server_default=sa.false(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'users', 'email_verified',
        existing_type=sa.Boolean(),
        server_default=None,
        existing_nullable=False,
    )

    op.drop_index('ix_email_verifications_code', table_name='email_verifications')
    op.drop_index('ix_email_verifications_token', table_name='email_verifications')
    op.drop_index('ix_email_verifications_user_id', table_name='email_verifications')
    op.drop_table('email_verifications')
