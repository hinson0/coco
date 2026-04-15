"""add_pro_fields

Revision ID: fe0be7ef44ff
Revises: f90273a4d519
Create Date: 2026-04-13 11:03:52.976343

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fe0be7ef44ff'
down_revision: Union[str, Sequence[str], None] = 'f90273a4d519'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT now(),
            ADD COLUMN IF NOT EXISTS pro_expires_at   timestamptz DEFAULT NULL;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS pro_expires_at,
            DROP COLUMN IF EXISTS trial_started_at;
    """)