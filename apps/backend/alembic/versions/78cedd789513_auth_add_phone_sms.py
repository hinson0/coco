"""auth_add_phone_sms

Revision ID: 78cedd789513
Revises: f39e00b5e1e0
Create Date: 2026-04-16 19:07:56.157111

"""
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '78cedd789513'
down_revision: str | None = 'f39e00b5e1e0'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TABLE users ADD COLUMN phone text UNIQUE")
    op.execute("ALTER TABLE users ALTER COLUMN email DROP NOT NULL")
    op.execute("ALTER TABLE users ALTER COLUMN password DROP NOT NULL")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT users_email_or_phone_check "
        "CHECK (email IS NOT NULL OR phone IS NOT NULL)"
    )
    op.execute("""
        CREATE TABLE IF NOT EXISTS sms_codes (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            phone      text NOT NULL,
            code       text NOT NULL,
            expires_at timestamptz NOT NULL,
            used       boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_sms_codes_phone ON sms_codes(phone)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS idx_sms_codes_phone")
    op.execute("DROP TABLE IF EXISTS sms_codes")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone_check")
    op.execute("ALTER TABLE users ALTER COLUMN password SET NOT NULL")
    op.execute("ALTER TABLE users ALTER COLUMN email SET NOT NULL")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS phone")
