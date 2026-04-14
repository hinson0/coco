"""record_source_add_notification

Revision ID: f39e00b5e1e0
Revises: f90273a4d519
Create Date: 2026-04-14 20:44:17.616589

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f39e00b5e1e0"
down_revision: Union[str, Sequence[str], None] = "f90273a4d519"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE record_source ADD VALUE IF NOT EXISTS 'notification';")


def downgrade() -> None:
    pass  # PostgreSQL 不支持从 ENUM 中删除值
