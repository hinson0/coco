"""chat_messages_add_audio_fields

Revision ID: fd484f85b8db
Revises: 70cf418e1cad
Create Date: 2026-04-11 17:40:49.865403

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fd484f85b8db"
down_revision: Union[str, Sequence[str], None] = "70cf418e1cad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_uri TEXT;")
    op.execute(
        "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE chat_messages DROP COLUMN IF EXISTS duration_seconds;")
    op.execute("ALTER TABLE chat_messages DROP COLUMN IF EXISTS audio_uri;")
