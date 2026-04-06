# CoCo AI 记账 - 后端 (FastAPI)

该目录包含基于 Python FastAPI 的后端服务，负责处理 ASR (语音识别)、OCR (拍照识票) 和自然语言处理 (GLM) 的核心业务逻辑，完全替代原有的 Supabase Edge Functions。

## 技术栈

- **框架**: [FastAPI](https://fastapi.tiangolo.com/)
- **包管理**: [uv](https://docs.astral.sh/uv/) (极速 Python 包管理器)
- **运行时**: Python 3.13
- **主要依赖**:
  - `supabase-py`: 数据库与认证集成
  - `tencentcloud-sdk-python`: 腾讯云 ASR/OCR 服务
  - `pydantic-settings`: 基于环境变量的配置管理

## 快速开始

### 1. 安装 uv

如果尚未安装 `uv`，请参考 [官方文档](https://docs.astral.sh/uv/getting-started/installation/) 或运行：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. 初始化环境

在 `apps/backend` 目录下执行：

```bash
uv sync
```

该命令会自动根据 `pyproject.toml` 创建虚拟环境并安装所有依赖。

### 3. 配置环境变量

请确保 `apps/backend/.env` 文件已配置（可参考 `.env.example`）：

- `GLM_API_KEY`
- `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`

### 4. 启动开发服务器

```bash
uv run uvicorn main:app --reload --port 8000
```

## 常用开发命令

- **添加依赖**: `uv add <package>`
- **指定 Python 版本初始化**: `uv init --python 3.13`
- **导出 requirements.txt**: `uv export --no-dev -o requirements.txt` (用于 Docker 构建或传统环境)

## 项目结构

- `main.py`: 应用入口与中间件配置
- `config.py`: 集中化配置管理
- `routers/`: 接口路由逻辑 (asr / ocr / text)
- `services/`: AI 供应商调用逻辑
- `schemas/`: Pydantic 请求与响应模型
