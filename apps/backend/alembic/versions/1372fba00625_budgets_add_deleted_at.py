"""budgets_add_deleted_at

Revision ID: 1372fba00625
Revises: 19cc71dd8594
Create Date: 2026-04-11 17:07:59.309316

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1372fba00625"
down_revision: Union[str, Sequence[str], None] = "19cc71dd8594"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;")


def downgrade() -> None:
    op.execute("ALTER TABLE budgets DROP COLUMN IF EXISTS deleted_at;")
