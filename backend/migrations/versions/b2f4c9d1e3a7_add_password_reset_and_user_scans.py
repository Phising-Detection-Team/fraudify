"""add_password_reset_and_user_scans

Revision ID: b2f4c9d1e3a7
Revises: 859afd3e27a1
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2f4c9d1e3a7'
down_revision: Union[str, Sequence[str], None] = '859afd3e27a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add password reset columns to users table
    op.add_column('users', sa.Column('password_reset_token', sa.String(length=128), nullable=True))
    op.add_column('users', sa.Column('password_reset_expires', sa.DateTime(), nullable=True))
    op.create_index(
        op.f('ix_users_password_reset_token'),
        'users',
        ['password_reset_token'],
        unique=True,
    )

    # Create user_scans table
    scan_verdict = sa.Enum(
        'phishing', 'likely_phishing', 'suspicious', 'likely_legitimate', 'legitimate',
        name='scan_verdict',
    )
    op.create_table(
        'user_scans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('subject', sa.String(length=512), nullable=True),
        sa.Column('body_snippet', sa.Text(), nullable=True),
        sa.Column('full_body', sa.Text(), nullable=True),
        sa.Column('verdict', scan_verdict, nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('scam_score', sa.Float(), nullable=True),
        sa.Column('reasoning', sa.Text(), nullable=True),
        sa.Column('scanned_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_user_scans_user_id'), 'user_scans', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_user_scans_user_id'), table_name='user_scans')
    op.drop_table('user_scans')
    # Drop enum type (PostgreSQL specific)
    sa.Enum(name='scan_verdict').drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f('ix_users_password_reset_token'), table_name='users')
    op.drop_column('users', 'password_reset_expires')
    op.drop_column('users', 'password_reset_token')
