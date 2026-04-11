"""transactions_add_account_id

Revision ID: 70cf418e1cad
Revises: 02aba126b7f3
Create Date: 2026-04-11 17:36:46.842383

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "70cf418e1cad"
down_revision: Union[str, Sequence[str], None] = "02aba126b7f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id);
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS account_id;")
