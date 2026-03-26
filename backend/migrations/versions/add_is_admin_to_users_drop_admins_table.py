"""Add is_admin column to users and drop admins table.

Revision ID: d1e2f3g4h5i6
Revises: c3d4e5f6a7b8
Create Date: 2026-03-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd1e2f3g4h5i6'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    """Add is_admin column to users table and drop admins table."""
    # Add is_admin column to users table with default value of False
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))
    
    # Copy admin status from admins table to users table (if admin record exists for user, set to True)
    # This is a data migration - users with admin records become is_admin=True
    op.execute("""
        UPDATE users 
        SET is_admin = true 
        WHERE id IN (SELECT user_id FROM admins)
    """)
    
    # Drop the admins table since its data is now in the users table
    op.drop_table('admins')


def downgrade():
    """Recreate admins table and remove is_admin column."""
    # Recreate the admins table
    op.create_table('admins',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    
    # Populate admins table from users.is_admin
    op.execute("""
        INSERT INTO admins (id, user_id, created_at)
        SELECT gen_random_uuid(), id, created_at 
        FROM users 
        WHERE is_admin = true
    """)
    
    # Remove is_admin column from users
    op.drop_column('users', 'is_admin')
