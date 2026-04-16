#!/bin/sh
set -e

echo "运行数据库迁移..."
uv run alembic upgrade head

echo "启动 FastAPI 服务..."
exec uv run gunicorn main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --graceful-timeout 30 \
  --access-logfile - \
  --error-logfile -
