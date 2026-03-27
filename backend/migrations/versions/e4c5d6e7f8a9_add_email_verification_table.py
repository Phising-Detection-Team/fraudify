"""Add email_verification table and email_verified_at column to users.

Revision ID: e4c5d6e7f8a9
Revises: 162fb1280553
Create Date: 2026-03-26 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'e4c5d6e7f8a9'
down_revision: Union[str, Sequence[str], None] = '162fb1280553'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add email_verified_at column to users table
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime(), nullable=True))

    # Create email_verifications table
    op.create_table(
        'email_verifications',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('verification_code', sa.String(6), nullable=False),
        sa.Column('verification_link_token', sa.String(128), nullable=False),
        sa.Column('email_verified_at', sa.DateTime(), nullable=True),
        sa.Column('code_expires_at', sa.DateTime(), nullable=False),
        sa.Column('link_expires_at', sa.DateTime(), nullable=False),
        sa.Column('verification_method_choice', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_email_verification_user_id'),
        sa.UniqueConstraint('verification_link_token', name='uq_verification_link_token'),
        sa.CheckConstraint("verification_method_choice IN ('link', 'code', 'both')", name='ck_email_verification_method'),
    )

    # Create index on verification_link_token for faster lookups
    op.create_index('ix_email_verifications_verification_link_token', 'email_verifications', ['verification_link_token'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop index
    op.drop_index('ix_email_verifications_verification_link_token', table_name='email_verifications')

    # Drop email_verifications table
    op.drop_table('email_verifications')

    # Drop email_verified_at column from users
    op.drop_column('users', 'email_verified_at')
