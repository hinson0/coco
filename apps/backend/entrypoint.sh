#!/bin/sh
set -e

echo "运行数据库迁移..."
uv run alembic upgrade head

echo "启动 FastAPI 服务..."
exec uv run uvicorn main:app --host 0.0.0.0 --port 8000
