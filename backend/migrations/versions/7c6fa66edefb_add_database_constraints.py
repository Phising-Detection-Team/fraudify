"""add database constraints

Revision ID: 7c6fa66edefb
Revises: f68964d2d980
Create Date: 2026-02-21 13:43:58.623689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = '7c6fa66edefb'
down_revision: Union[str, Sequence[str], None] = 'f68964d2d980'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create new Overrides table
    op.create_table('Overrides',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email_test_id', sa.Integer(), nullable=False),
    sa.Column('verdict', sa.String(length=20), nullable=False),
    sa.Column('overridden_by', sa.String(length=100), nullable=True),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.CheckConstraint("verdict IN ('correct','incorrect','phishing','legitimate')", name='ck_override_verdict_enum'),
    sa.ForeignKeyConstraint(['email_test_id'], ['Emails.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email_test_id', name='uq_override_email_test_id')
    )
    op.create_index(op.f('ix_Overrides_email_test_id'), 'Overrides', ['email_test_id'], unique=False)
    
    # Clean up old tables
    op.drop_index(op.f('ix_Manual_Overrides_email_test_id'), table_name='Manual_Overrides')
    op.drop_table('Manual_Overrides')
    
    # Modify API_calls table (use batch mode for SQLite compatibility)
    with op.batch_alter_table('API_calls', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email_id', sa.Integer(), nullable=False))
        batch_op.add_column(sa.Column('round_id', sa.Integer(), nullable=False))
        batch_op.drop_index(op.f('ix_API_calls_email_test_id'))
        batch_op.create_index(op.f('ix_API_calls_round_id'), ['round_id'], unique=False)
        batch_op.drop_column('id')
        batch_op.drop_column('email_test_id')
        batch_op.create_foreign_key('fk_api_calls_emails_round_id', 'Emails', ['round_id'], ['id'], ondelete='CASCADE')
    
    # Modify Emails table
    with op.batch_alter_table('Emails', schema=None) as batch_op:
        batch_op.add_column(sa.Column('generator_latency_ms', sa.Integer(), nullable=True))
        batch_op.drop_column('judge_verdict')
        batch_op.drop_column('judge_ground_truth')
        batch_op.drop_column('judge_reasoning')
        batch_op.drop_column('is_judge_correct')
        batch_op.drop_column('generator_latenc_ms')
        batch_op.drop_column('judge_quality_score')
        batch_op.drop_column('judge_latency_ms')
    
    # Modify Logs table
    op.drop_index(op.f('ix_Logs_level'), table_name='Logs')
    
    # Modify Rounds table
    with op.batch_alter_table('Rounds', schema=None) as batch_op:
        batch_op.alter_column('started_at',
                   existing_type=sa.DATETIME(),
                   nullable=False)
        batch_op.alter_column('completed_at',
                   existing_type=sa.DATETIME(),
                   nullable=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # Modify Rounds table
    with op.batch_alter_table('Rounds', schema=None) as batch_op:
        batch_op.alter_column('completed_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        batch_op.alter_column('started_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
    
    # Recreate Logs index
    op.create_index(op.f('ix_Logs_level'), 'Logs', ['level'], unique=False)
    
    # Modify Emails table
    with op.batch_alter_table('Emails', schema=None) as batch_op:
        batch_op.add_column(sa.Column('judge_latency_ms', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('judge_quality_score', sa.INTEGER(), nullable=False))
        batch_op.add_column(sa.Column('generator_latenc_ms', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('is_judge_correct', sa.BOOLEAN(), nullable=False))
        batch_op.add_column(sa.Column('judge_reasoning', sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column('judge_ground_truth', sa.VARCHAR(length=20), nullable=False))
        batch_op.add_column(sa.Column('judge_verdict', sa.VARCHAR(length=20), nullable=False))
        batch_op.drop_column('generator_latency_ms')
    
    # Modify API_calls table
    with op.batch_alter_table('API_calls', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email_test_id', sa.INTEGER(), nullable=False))
        batch_op.add_column(sa.Column('id', sa.INTEGER(), nullable=False))
        batch_op.drop_column('round_id')
        batch_op.drop_column('email_id')
        batch_op.create_index(op.f('ix_API_calls_email_test_id'), ['email_test_id'], unique=False)
        batch_op.create_foreign_key('fk_api_calls_emails_email_test_id', 'Emails', ['email_test_id'], ['id'], ondelete='CASCADE')
    
    # Recreate Manual_Overrides table
    op.create_table('Manual_Overrides',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('email_test_id', sa.INTEGER(), nullable=False),
    sa.Column('verdict', sa.VARCHAR(length=20), nullable=False),
    sa.Column('overridden_by', sa.VARCHAR(length=100), nullable=True),
    sa.Column('reason', sa.TEXT(), nullable=True),
    sa.Column('created_at', sa.DATETIME(), nullable=True),
    sa.ForeignKeyConstraint(['email_test_id'], ['Emails.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_Manual_Overrides_email_test_id'), 'Manual_Overrides', ['email_test_id'], unique=False)
    
    # Drop Overrides table
    op.drop_index(op.f('ix_Overrides_email_test_id'), table_name='Overrides')
    op.drop_table('Overrides')
    # ### end Alembic commands ###
