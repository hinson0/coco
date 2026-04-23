# 切换 mobile 端生产 API 到 https://api.cocoai.chat

## Context

后端域名 `api.cocoai.chat` 的 ICP 备案已通过（2026-04-16 提交，现已放行），Nginx 也已完成 HTTPS 反向代理。此前 `apps/mobile/.env.example` 的生产环境 URL 仍是 `http://119.45.41.158:8000`（HTTP + IP:8000），需要更新为 `https://api.cocoai.chat`（HTTPS + 域名，走标准 443），让正式构建走域名 + TLS，去掉明文 IP 直连的遗留。

开发环境仍连本地 uvicorn（局域网 IP + HTTP），因此 `EXPO_PUBLIC_API_URL_DEV` 模板保持不变，`android.usesCleartextTraffic` 也保留，确保 Android 真机 / 模拟器还能连本地后端。

## 现状摘要（关键事实）

- 集中配置：`apps/mobile/lib/config.ts` 通过 `__DEV__` 三元运算决定用 `EXPO_PUBLIC_API_URL_DEV` 还是 `EXPO_PUBLIC_API_URL`，导出 `API_BASE`。所有 HTTP/SSE/Auth 调用都经由它，**没有任何硬编码 IP 分散在业务代码里**。
- 仓库里只有 `apps/mobile/.env.example`，没有提交实际 `.env`（`.gitignore` 仅排除 `.env*.local`，但 `.env` 事实上也未提交）。开发者自行从 example 复制。
- `app.json` 当前设置 `android.usesCleartextTraffic: true`，用于允许 HTTP 连本地/之前的 IP 后端。

## 修改清单

### 1. `apps/mobile/.env.example`（唯一代码变更）

把第 2 行生产 URL 换成 HTTPS 域名：

```diff
- EXPO_PUBLIC_API_URL=http://119.45.41.158:8000
+ EXPO_PUBLIC_API_URL=https://api.cocoai.chat
```

dev 段落（`EXPO_PUBLIC_API_URL_DEV=http://192.168.x.x:8000` 与上方注释）**保持不变**。

### 2. 开发者本地 `.env` 同步（每人一次）

`.env` 未入库，需要告知团队：将各自本地 `apps/mobile/.env` 的 `EXPO_PUBLIC_API_URL` 同步改为 `https://api.cocoai.chat`（该值只在非 `__DEV__` 打包时生效，expo start 用的是 dev 那条）。

## 不修改的项（已确认）

- `apps/mobile/app.json` 的 `android.usesCleartextTraffic: true` —— 保留。Dev 仍走 `http://192.168.x.x:8000`，Android 必须允许明文，否则真机连不上本地 uvicorn。
- `EXPO_PUBLIC_API_URL_DEV` 默认模板 —— 保留局域网 IP，仍用于本地后端调试。
- `lib/config.ts` / `lib/api.ts` / `lib/sse.ts` / `lib/auth.ts` —— 全部通过 `API_BASE` 间接引用，无需改动。
- iOS ATS —— HTTPS + 有效证书，不再需要 NSAllowsArbitraryLoads 例外（原本 Expo 默认也未显式放开，切 HTTPS 后更安全）。

## 关键文件

| 文件 | 作用 | 是否修改 |
|---|---|---|
| `apps/mobile/.env.example` | 环境变量模板，开发者复制来源 | ✅ 改第 2 行 |
| `apps/mobile/lib/config.ts` | `API_BASE` 唯一出口，`__DEV__` 三元分流 | 只读（逻辑无需改） |
| `apps/mobile/app.json` | Expo 配置，含 Android cleartext 开关 | 只读（保留 cleartext） |
| `apps/mobile/lib/api.ts` / `lib/sse.ts` / `lib/auth.ts` | HTTP/SSE/Auth 调用，均使用 `API_BASE` | 只读 |

## 验证步骤

本地开发（continue 连本地后端，验证 dev 路径没被影响）：

1. `cd apps/mobile && pnpm start`
2. 打开应用，执行一次登录 / 聊天 / 语音记账 —— 请求应落在 `http://192.168.x.x:8000`（dev URL 未变）。

生产模拟（验证 prod URL 真能连到 nginx）：

1. 临时把 `apps/mobile/.env` 的 `EXPO_PUBLIC_API_URL` 改成 `https://api.cocoai.chat`，并把开发脚本切到非 `__DEV__` 构建（或本地做一次 `eas build --profile preview` / `expo export` 走 release 路径）。
2. 在真机安装 release 包，登录 / 同步 / 聊天三条主链路各跑一次，确认：
   - 请求日志里看到 `https://api.cocoai.chat/...`
   - Nginx 访问日志里能看到对应请求
   - iOS 不出 ATS 错误；Android 不出证书错误
3. 回归命令行验证证书链：`curl -v https://api.cocoai.chat/health`（或后端已有的健康检查端点），确认返回 200 且证书有效。

## 后续可选清理（不在本次）

- ICP 备案正式公示后，若确认 dev 也要改走 HTTPS 域名，再删除 `android.usesCleartextTraffic`、升级 dev 模板。
- memory `project_icp_filing` 切到"已通过"状态（另起一次对话用 /remember 记一下即可）。
