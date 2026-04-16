# Docker 生产部署知识点

## 1. Uvicorn vs Gunicorn — 工业标准

| 方案 | 适用场景 | 说明 |
|-----|---------|-----|
| `uvicorn --workers N` | 开发/简单部署 | 多进程实现简陋，worker 崩溃不会自动重启 |
| `gunicorn -k uvicorn.workers.UvicornWorker` | **生产标准** | 成熟进程管理器，支持 graceful reload、健康检查、worker 生命周期管理 |
| `uvicorn --workers 1` + K8s 副本 | 容器编排环境 | 靠编排层水平扩展，每容器单进程 |

**结论：** 单机 Docker 用 gunicorn 管理 uvicorn worker；K8s/ECS 保持单 worker，靠副本数扩容。

## 2. Workers 数量

**经验公式（异步场景）：**

```
workers = CPU核心数 × 2
```

| 实例规格 | workers |
|---------|---------|
| 1C2G | 2 |
| 2C4G | 4 |
| 4C8G | 8 |

**注意：** workers 数量不应超过 Docker `--cpus` 配额，否则造成 CPU 竞争反而降低性能。

## 3. Gunicorn 生产配置

```sh
exec gunicorn main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --graceful-timeout 30 \
  --access-logfile - \
  --error-logfile -
```

- `--timeout 120`：worker 超时时间（秒），防止 worker 卡死
- `--graceful-timeout 30`：优雅关闭等待时间
- `--access-logfile -`：访问日志输出到 stdout（Docker 可用 `docker logs` 查看）

## 4. uv 镜像加速

pip 和 uv 使用不同的镜像配置方式：

```dockerfile
# 腾讯云 PyPI 镜像
ENV TENCENT_MIRROR=https://mirrors.tencent.com/pypi/simple/

# pip 用 -i 参数
RUN pip install -i ${TENCENT_MIRROR} uv

# uv 用 --index-url 参数（ENV UV_INDEX_URL 不一定可靠）
RUN uv sync --frozen --no-dev --index-url ${TENCENT_MIRROR}
```

**关键点：**
- `pip -i` 只对 pip 生效，uv 不认
- `UV_INDEX_URL` 环境变量理论上有效，但实测可能不稳定
- 最可靠方式：`uv sync --index-url <url>` 直接在命令行传参

## 5. Docker Layer 缓存策略

```dockerfile
# 1. 先复制依赖声明文件（变动少）
COPY pyproject.toml uv.lock ./

# 2. 安装依赖（只有依赖变动时才重新执行）
RUN uv sync --frozen --no-dev --index-url ${TENCENT_MIRROR}

# 3. 最后复制源码（变动频繁）
COPY . .
```

**原理：** Docker 按层缓存，只要前面的层没变，后面的层直接用缓存。把变动频率低的操作放前面，可以避免每次改代码都重新安装依赖。

**缓存失效条件：** `pyproject.toml` 或 `uv.lock` 有任何变动 → 依赖层缓存失效 → 所有依赖重新下载。

## 6. Docker Compose 常用命令

```sh
# 全部服务重建并启动（后台）
docker compose up -d --build

# 只重建某个服务（不影响其他服务）
docker compose build backend && docker compose up -d backend

# 查看日志
docker compose logs -f backend

# 停止所有服务
docker compose down
```

- `--build`：强制重新构建镜像（不加则用旧镜像）
- `-d`：后台运行（detached）
- build 的是你的应用镜像（Dockerfile 定义），不是基础镜像（如 `python:3.13-slim`）
