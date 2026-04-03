# Silicon Chat Endpoint 设计文档

**日期**: 2026-04-03  
**分支**: silicon-refactor  
**状态**: 待实现

---

## 背景

当前语音记账流程中，规则引擎未命中时直接提示用户"手动记账"，无 LLM 兜底。原有 GLM 兜底已被移除（响应太慢）。

本设计用 SiliconFlow（Qwen3-8B）替代 GLM，新建 `/chat` 端点，处理规则引擎未命中后的三种意图：记账、查询、闲聊。

---

## 目标

- 规则引擎未命中时调用 SiliconFlow 判断意图并处理
- 支持三种意图：`record`（提取账单）、`query`（查数据库）、`chat`（闲聊）
- 不改动 `/text`、`/record-asr` 等现有端点

---

## 数据流

```
用户说话
  │
  ▼
腾讯云 ASR → asrText
  │  空字符串 → "没听清，要不再说一次？"（不变）
  ▼
规则引擎 parse(asrText)
  │  命中 → 创建账单卡片（不变）
  │
  └─ 未命中 → POST /chat
                │
                ├─ Step 1: SiliconFlow 判断意图
                │          返回 "record" | "query" | "chat"
                │
                ├─ intent = "record"
                │    Step 2a: SiliconFlow 提取账单字段
                │    后端: 返回字段，不创建记录
                │    返回: { type: "bill", transaction: {...} }
                │    前端: 调 createTransaction()，渲染 bill_card
                │
                ├─ intent = "query"
                │    Step 2b: SiliconFlow 生成 SELECT SQL
                │    Step 3b: 后端执行 SQL（安全校验）
                │    Step 4b: SiliconFlow 将结果转自然语言
                │    返回: { type: "text", content: "这周花了 ¥238..." }
                │    前端: 渲染文字气泡
                │
                └─ intent = "chat"
                     Step 2c: SiliconFlow 直接生成回复
                     返回: { type: "text", content: "..." }
                     前端: 渲染文字气泡
```

---

## 后端实现

### 新增文件

#### `apps/backend/services/silicon.py`

SiliconFlow 兼容 OpenAI 格式：
- base URL: `https://api.siliconflow.cn/v1`
- model: `Qwen/Qwen3-8B`

提供以下函数：

```python
async def classify_intent(text: str) -> str
    # 返回 "record" | "query" | "chat"

async def extract_bill(text: str) -> dict | None
    # 返回 {"amount": float, "category": str, "note": str,
    #        "type": "expense"|"income", "occurred_at": str}
    # 失败返回 None

async def generate_sql(text: str, schema: str) -> str
    # 返回 SELECT SQL 语句

async def summarize_result(question: str, rows: list) -> str
    # 将查询结果行转为自然语言回复

async def chat_reply(text: str) -> str
    # 闲聊回复，系统 prompt：记账助手人格，简短友好
```

#### `apps/backend/schemas/chat.py`

```python
class ChatRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    type: Literal["bill", "text"]
    transaction: Transaction | None = None  # type="bill" 时有值
    content: str | None = None             # type="text" 时有值
```

#### `apps/backend/routers/chat.py`

端点：`POST /chat`

流程：
1. 调 `classify_intent(text)`
2. 根据意图分支处理
3. `record` 分支：调 `extract_bill`，失败则返回 `{ type: "text", content: "没解析到账单信息" }`
4. `query` 分支：调 `generate_sql`，安全校验，执行 SQL，调 `summarize_result`
5. `chat` 分支：调 `chat_reply`

**SQL 安全校验**（只允许 SELECT）：

```python
def is_safe_sql(sql: str) -> bool:
    stripped = sql.strip().upper()
    return stripped.startswith("SELECT") and not any(
        kw in stripped for kw in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]
    )
```

SQL 校验失败时返回 `{ type: "text", content: "查询失败，请换个说法" }`。

**注入给 generate_sql 的 schema 上下文**（静态字符串）：

```
表: transactions(id, amount, type, category_id, note, occurred_at, user_id)
表: categories(id, name, type, user_id)
type 字段值: "expense" 或 "income"
occurred_at 为 ISO 8601 UTC 时间
必须包含 WHERE user_id = :user_id（占位符，由后端注入）
```

**SQL 执行方式**（参数化查询，user_id 从 JWT 注入，LLM 不接触真实 user_id）：

```python
# 伪代码
sql = await generate_sql(text, SCHEMA_CONTEXT)
if not is_safe_sql(sql):
    return error_response
rows = await db.fetch(sql, {"user_id": current_user.id})
```

### 修改文件

#### `apps/backend/config.py`

新增：
```python
silicon_api_key: str
```

#### `apps/backend/.env.example`

新增：
```
SILICON_API_KEY=
```

#### `apps/backend/main.py`

注册新路由：
```python
from routers.chat import router as chat_router
app.include_router(chat_router)
```

---

## 前端实现

### 修改文件

#### `apps/mobile/hooks/useChat.ts` — `processText()`

规则引擎未命中时，原来直接显示"没识别到记账信息，可以试试手动记账"，改为：

1. 显示"思考中..."占位消息（assistant，text 类型）
2. 调 `apiFetch<ChatResponse>("/chat", { method: "POST", body: JSON.stringify({ text }) })`
3. 更新占位消息：
   - `resp.type === "bill"`：调现有 `createTransaction` 逻辑，渲染 `bill_card`
   - `resp.type === "text"`：更新占位消息内容为 `resp.content`

加载状态复用 `sendAsr` 中已有的消息更新模式（`db.runAsync UPDATE`）。

### 不改动

- `ChatInputBar.tsx`
- `VoiceBubble.tsx`
- `useVoiceRecorder.ts`
- `sendAsr()` 函数
- `/text`、`/record-asr` 端点

---

## 错误处理

| 场景 | 处理 |
|------|------|
| SiliconFlow API 超时/报错 | 返回 `{ type: "text", content: "处理失败，请稍后再试" }` |
| `extract_bill` 返回 None | 返回 `{ type: "text", content: "没解析到账单信息，可以试试手动记账" }` |
| SQL 安全校验失败 | 返回 `{ type: "text", content: "查询失败，请换个说法" }` |
| SQL 执行报错 | 返回 `{ type: "text", content: "查询出错，请稍后再试" }` |

---

## 不在本次范围内

- 多轮对话上下文（历史消息传给 LLM）
- 查询结果图表展示
- `/text` 端点的 GLM→SiliconFlow 替换（保留现状）
- 闲聊的流式输出（streaming）
