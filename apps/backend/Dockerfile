FROM python:3.13-slim

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 先复制依赖文件（利用 Docker layer 缓存）
COPY pyproject.toml uv.lock* ./

# 安装依赖（不安装 dev 依赖）
RUN uv sync --frozen --no-dev

# 复制源码
COPY . .

# 复制并设置启动脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
