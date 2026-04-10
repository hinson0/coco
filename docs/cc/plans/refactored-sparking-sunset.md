# Plan: justfile dev 命令支持自定义端口

## Context

当前 `just dev` 硬编码后端端口为 8000，前端使用 Expo 默认端口 8081。用户需要支持 `just dev 8000` 语法，让后端端口可配置，前端端口 = 后端端口 + 80（如后端 8000 → 前端 8080，后端 8001 → 前端 8081）。

## 修改文件

- `justfile`

## 实现

将 `dev` recipe 改为接收可选参数 `port`（默认 8000）：

```just
# 启动基础设施+前后端开发服务器 (port: 后端端口，前端 = port+80)
dev port="8000":
    docker compose up -d
    npx concurrently -n backend,frontend -c blue,green \
        "cd apps/backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port {{ port }}" \
        "EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 pnpm --filter mobile expo start --port $(( {{ port }} + 80 ))"
```

要点：
- `port="8000"` — just 的可选参数语法，默认值 8000，`just dev` 和 `just dev 8001` 都能用
- `$(( {{ port }} + 80 ))` — shell 算术展开计算前端端口
- Expo dev server 通过 `--port` 标志指定端口

## 注意

- 前端 `EXPO_PUBLIC_API_URL` 仍由 `.env` 文件控制，不在此处修改（它指向真机调试的局域网 IP，与 dev server 端口无关）
- `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0` 确保 Expo 监听所有接口

## 验证

1. `just dev` — 后端 8000，前端 8080
2. `just dev 8001` — 后端 8001，前端 8081
