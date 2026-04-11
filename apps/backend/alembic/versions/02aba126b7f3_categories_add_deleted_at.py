"""categories_add_deleted_at

Revision ID: 02aba126b7f3
Revises: 1372fba00625
Create Date: 2026-04-11 17:25:42.982807

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "02aba126b7f3"
down_revision: Union[str, Sequence[str], None] = "1372fba00625"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS deleted_at;")
