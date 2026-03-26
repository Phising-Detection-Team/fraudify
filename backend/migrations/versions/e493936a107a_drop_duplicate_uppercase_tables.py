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
    """Recreate uppercase tables that were dropped by upgrade."""
    # Rounds — started_at/completed_at are NOT NULL after 7c6fa66edefb
    op.create_table('Rounds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=False),
        sa.Column('total_emails', sa.Integer(), nullable=True),
        sa.Column('processed_emails', sa.Integer(), nullable=True),
        sa.Column('detector_accuracy', sa.Float(), nullable=True),
        sa.Column('generator_success_rate', sa.Float(), nullable=True),
        sa.Column('avg_confidence_score', sa.Float(), nullable=True),
        sa.Column('processing_time', sa.Integer(), nullable=True),
        sa.Column('total_cost', sa.Float(), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Emails — judge columns removed, generator_latency_ms added (7c6fa66edefb)
    op.create_table('Emails',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('generated_content', sa.Text(), nullable=False),
        sa.Column('generated_prompt', sa.Text(), nullable=True),
        sa.Column('generated_subject', sa.String(length=100), nullable=True),
        sa.Column('generated_body', sa.Text(), nullable=True),
        sa.Column('is_phishing', sa.Boolean(), nullable=False),
        sa.Column('generated_email_metadata', sa.JSON(), nullable=False),
        sa.Column('generator_latency_ms', sa.Integer(), nullable=True),
        sa.Column('detector_verdict', sa.String(length=20), nullable=False),
        sa.Column('detector_risk_score', sa.Float(), nullable=True),
        sa.Column('detector_confidence', sa.Float(), nullable=True),
        sa.Column('detector_reasoning', sa.Text(), nullable=True),
        sa.Column('detector_latency_ms', sa.Integer(), nullable=True),
        sa.Column('manual_override', sa.Boolean(), nullable=True),
        sa.Column('override_verdict', sa.String(length=20), nullable=True),
        sa.Column('override_reason', sa.Text(), nullable=True),
        sa.Column('overridden_by', sa.String(length=100), nullable=True),
        sa.Column('overridden_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('processing_time', sa.Float(), nullable=True),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['round_id'], ['Rounds.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_Emails_round_id'), 'Emails', ['round_id'], unique=False)

    # Logs — ix_Logs_level was dropped in 7c6fa66edefb (its downgrade will re-add it)
    op.create_table('Logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=True),
        sa.Column('level', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['round_id'], ['Rounds.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_Logs_round_id'), 'Logs', ['round_id'], unique=False)
    op.create_index(op.f('ix_Logs_timestamp'), 'Logs', ['timestamp'], unique=False)

    # API_calls — no 'id' PK (dropped in 7c6fa66edefb); round_id FK references Emails.id
    op.create_table('API_calls',
        sa.Column('email_id', sa.Integer(), nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('agent_type', sa.String(length=20), nullable=True),
        sa.Column('model_name', sa.String(length=20), nullable=True),
        sa.Column('token_used', sa.Integer(), nullable=True),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['round_id'], ['Emails.id'],
                                name='fk_api_calls_emails_round_id', ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_API_calls_round_id'), 'API_calls', ['round_id'], unique=False)

    # Overrides — created in 7c6fa66edefb
    op.create_table('Overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email_test_id', sa.Integer(), nullable=False),
        sa.Column('verdict', sa.String(length=20), nullable=False),
        sa.Column('overridden_by', sa.String(length=100), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint("verdict IN ('correct','incorrect','phishing','legitimate')",
                           name='ck_override_verdict_enum'),
        sa.ForeignKeyConstraint(['email_test_id'], ['Emails.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email_test_id', name='uq_override_email_test_id')
    )
    op.create_index(op.f('ix_Overrides_email_test_id'), 'Overrides', ['email_test_id'], unique=False)

    # manual_overrides (lowercase) — created in ca864f75f53b, FK to lowercase emails
    op.create_table('manual_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email_id', sa.Integer(), nullable=False),
        sa.Column('verdict', sa.String(length=20), nullable=False),
        sa.Column('overridden_by', sa.String(length=100), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint("verdict IN ('correct','incorrect','phishing','legitimate')",
                           name='ck_override_verdict_enum'),
        sa.ForeignKeyConstraint(['email_id'], ['emails.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email_id', name='uq_override_email_id')
    )
    op.create_index(op.f('ix_manual_overrides_email_id'), 'manual_overrides', ['email_id'], unique=False)
