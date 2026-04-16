# 启用 BuildKit 特性（需在构建命令前设置 DOCKER_BUILDKIT=1）
# syntax=docker/dockerfile:1

FROM python:3.13-slim

# 使用腾讯云内网镜像源（若宿主机在腾讯云内网）
ENV UV_INDEX_URL=https://mirrors.tencent.com/pypi/simple/

# 安装 uv，并利用 BuildKit 缓存 pip 下载
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -i ${UV_INDEX_URL} uv

WORKDIR /app

# 先复制依赖文件，利用 Docker layer 缓存
COPY pyproject.toml uv.lock ./

# 安装依赖（关键：使用 BuildKit 缓存 uv 下载的包）
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# 复制源码
COPY . .

# 安装项目本身（此时依赖已缓存，仅安装本地项目）
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# 复制并设置启动脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]