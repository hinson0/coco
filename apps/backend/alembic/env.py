from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context
from infra.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 从 settings 读取数据库 URL（async → sync for alembic）
db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

target_metadata = None


def run_migrations_offline() -> None:
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(db_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
