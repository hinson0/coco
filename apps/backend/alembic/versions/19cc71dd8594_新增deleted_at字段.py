"""新增deleted_at字段

Revision ID: 19cc71dd8594
Revises: 494dc00061d3
Create Date: 2026-04-11 16:13:28.757536

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "19cc71dd8594"
down_revision: Union[str, Sequence[str], None] = "494dc00061d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE chat_messages DROP COLUMN IF EXISTS deleted_at;")
