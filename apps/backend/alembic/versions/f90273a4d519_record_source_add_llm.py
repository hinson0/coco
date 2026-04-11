"""record_source_add_llm

Revision ID: f90273a4d519
Revises: fd484f85b8db
Create Date: 2026-04-11 17:44:54.757729

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f90273a4d519"
down_revision: Union[str, Sequence[str], None] = "fd484f85b8db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE record_source ADD VALUE IF NOT EXISTS 'llm';")


def downgrade() -> None:
    pass  # PostgreSQL 不支持从 ENUM 中删除值
