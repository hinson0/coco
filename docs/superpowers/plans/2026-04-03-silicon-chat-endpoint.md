# Silicon Chat Endpoint 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 规则引擎未命中时，调用 SiliconFlow（Qwen3-8B）判断意图并处理三种路径：记账提取、自然语言查询、闲聊回复。

**Architecture:** 后端新增 `services/silicon.py`（SiliconFlow API）、`schemas/chat.py`（响应结构）、`routers/chat.py`（`/chat` 端点），前端 `processText()` 在规则引擎未命中时调用 `/chat` 并根据返回类型渲染气泡。

**Tech Stack:** Python 3.13 / FastAPI / httpx / Pydantic v2 / SiliconFlow API（OpenAI 兼容）/ React Native / TypeScript

---

> ⚠️ **Learning 模式说明**
> - **后端 Python 代码**：步骤中只提供函数签名、参数说明和关键逻辑，**完整代码由你自己写**
> - **前端代码**：提供完整代码，**你负责其中 ≥30%** 的部分（标注了 `[你来写]` 的地方）

---

## 文件清单

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `apps/backend/config.py` | 新增 silicon_api_key 字段 |
| 修改 | `apps/backend/.env.example` | 新增 SILICON_API_KEY 示例 |
| 新建 | `apps/backend/services/silicon.py` | SiliconFlow API 调用 + JSON/SQL 提取工具 |
| 新建 | `apps/backend/schemas/chat.py` | /chat 端点的请求/响应 schema |
| 新建 | `apps/backend/routers/chat.py` | /chat 端点，orchestrate 三种意图 |
| 修改 | `apps/backend/routers/__init__.py` | 注册 chat router |
| 修改 | `apps/mobile/hooks/useChat.ts` | processText() 增加 /chat fallback |

---

## Task 1: 后端 — 配置密钥

**Files:**
- Modify: `apps/backend/config.py`
- Modify: `apps/backend/.env.example`

> 🖊️ **你来写**：这两个文件的修改。

- [ ] **Step 1.1: 在 config.py 中新增 silicon_api_key 字段**

  打开 `apps/backend/config.py`，在 `Settings` 类里加一行：

  ```
  silicon_api_key: str
  ```

  位置：紧跟 `glm_api_key: str` 之后。格式完全相同，pydantic-settings 会自动从 `.env` 里读取 `SILICON_API_KEY`。

- [ ] **Step 1.2: 在 .env.example 中新增示例行**

  打开 `apps/backend/.env.example`，在 `# 智谱 AI` 下面新增一节：

  ```
  # SiliconFlow
  SILICON_API_KEY=
  ```

- [ ] **Step 1.3: 在本地 .env 中填入真实 key**

  复制 `.env.example` → `.env`（如果还没做），填入你的 SiliconFlow API Key：

  ```
  SILICON_API_KEY=sk-xxxxxxxxxxxx
  ```

  SiliconFlow key 在 [https://cloud.siliconflow.cn](https://cloud.siliconflow.cn) 控制台获取。

- [ ] **Step 1.4: 验证配置加载**

  在 `apps/backend/` 目录下运行：

  ```bash
  python -c "from config import settings; print(settings.silicon_api_key[:8])"
  ```

  预期输出：key 的前 8 位字符（不是报错）。

- [ ] **Step 1.5: Commit**

  ```bash
  git add apps/backend/config.py apps/backend/.env.example
  git commit -m "feat(backend): 新增 SiliconFlow API key 配置"
  ```

---

## Task 2: 后端 — services/silicon.py

**Files:**
- Create: `apps/backend/services/silicon.py`

> 🖊️ **你来写**：这个文件的全部代码。下面是每个函数的详细说明。

### 总体结构

文件需要提供 5 个 async 函数 + 2 个工具函数：

```python
# 工具函数（参考 services/glm.py 已有的 extract_json / extract_sql）
def extract_json(raw: str) -> dict | None: ...
def extract_sql(raw: str) -> str: ...

# API 调用核心（私有）
async def _call_silicon(system: str, user: str) -> str: ...

# 对外暴露的 5 个函数
async def classify_intent(text: str) -> str: ...         # 返回 "record" | "query" | "chat"
async def extract_bill(text: str) -> dict | None: ...    # 返回账单 dict 或 None
async def generate_sql(text: str) -> str: ...            # 返回 SELECT SQL
async def summarize_result(question: str, rows: list) -> str: ...
async def chat_reply(text: str) -> str: ...
```

- [ ] **Step 2.1: 实现 _call_silicon 私有函数**

  SiliconFlow 与 OpenAI API 完全兼容，只需换 base URL 和 key：

  - URL: `https://api.siliconflow.cn/v1/chat/completions`
  - Header: `Authorization: Bearer {settings.silicon_api_key}`
  - Model: `"Qwen/Qwen3-8B"`
  - Payload 格式：
    ```json
    {
      "model": "Qwen/Qwen3-8B",
      "messages": [
        {"role": "system", "content": "<system_prompt>"},
        {"role": "user", "content": "<user_text>"}
      ]
    }
    ```
  - 返回值：`response.json()["choices"][0]["message"]["content"]`
  - 使用 `httpx.AsyncClient`，timeout=30
  - 参考 `services/glm.py` 的 `call_glm` 函数结构

- [ ] **Step 2.2: 实现 classify_intent**

  System prompt（逐字使用）：
  ```
  你是记账助手。判断用户输入的意图，只返回 JSON。
  格式：{"intent": "record"} 或 {"intent": "query"} 或 {"intent": "chat"}
  - record：用户在描述一笔消费或收入（如"买了杯咖啡30块"）
  - query：用户在查询历史数据（如"这周花了多少"）
  - chat：闲聊或其他（如"谢谢"、"你是谁"）
  只返回 JSON，不要其他文字。
  ```

  逻辑：调用 `_call_silicon(system, text)`，用 `extract_json` 解析结果，取 `intent` 字段。
  解析失败时默认返回 `"chat"`。

- [ ] **Step 2.3: 实现 extract_bill**

  使用当前时间构建 user prompt（需要 `from datetime import datetime, timezone`）：

  System prompt：
  ```
  从文字中提取记账信息，只返回 JSON。
  格式：{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}
  分类选项：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
  occurred_at 使用 ISO 8601 格式（如 2026-04-03T14:30:00+08:00）
  只返回 JSON，不要其他文字。
  ```

  User prompt 格式：`f"当前时间：{now}\n文字：{text}"`

  逻辑：调用 `_call_silicon`，用 `extract_json` 解析，校验 `amount > 0`，失败返回 `None`。

- [ ] **Step 2.4: 实现 generate_sql**

  System prompt（包含 schema 上下文）：
  ```
  将用户的问题转为 PostgreSQL SELECT 查询。
  表结构：
  - transactions(id, user_id, category_id, amount, type, note, occurred_at, deleted_at)
  - categories(id, user_id, name, type)
  规则：
  1. 只生成 SELECT 语句
  2. 必须包含 WHERE deleted_at IS NULL
  3. 不要包含 user_id 条件（服务端自动注入）
  4. occurred_at 是 UTC 时间，时间范围用 >= / <= 过滤
  只返回 SQL，不要其他文字。
  ```

  User prompt 格式：`f"当前时间（UTC）：{now}\n问题：{text}"`

  逻辑：调用 `_call_silicon`，用 `extract_sql` 提取 SQL（去掉 markdown 代码块）。

- [ ] **Step 2.5: 实现 summarize_result**

  System prompt：
  ```
  你是记账助手。根据查询结果，用简洁的中文回答用户的问题。
  结果为空列表时说"没有找到相关记录"。金额保留两位小数，加"¥"符号。
  ```

  User prompt：`f"用户问："{question}"\n查询结果：{rows}"`

  逻辑：直接调用 `_call_silicon`，返回原始字符串。

- [ ] **Step 2.6: 实现 chat_reply**

  System prompt：
  ```
  你是 CoCo 记账助手，性格友好简洁。用简短的中文回应用户。
  不要主动提供记账帮助，只回应用户说的内容。回复在 50 字以内。
  ```

  逻辑：直接调用 `_call_silicon`，返回原始字符串。

- [ ] **Step 2.7: 手动测试 silicon.py**

  在 `apps/backend/` 下运行临时测试脚本（测完可删）：

  ```bash
  python -c "
  import asyncio
  from services.silicon import classify_intent, extract_bill, chat_reply

  async def test():
      print(await classify_intent('买了杯咖啡30块'))
      print(await classify_intent('这周花了多少钱'))
      print(await classify_intent('你好'))
      print(await extract_bill('昨天吃饭花了58.5元'))
      print(await chat_reply('谢谢你'))

  asyncio.run(test())
  "
  ```

  预期输出（顺序）：
  ```
  record
  query
  chat
  {'amount': 58.5, 'category': '餐饮', 'note': '...', 'occurred_at': '...', 'type': 'expense'}
  （简短友好的回复）
  ```

- [ ] **Step 2.8: Commit**

  ```bash
  git add apps/backend/services/silicon.py
  git commit -m "feat(backend): 实现 SiliconFlow 服务层（Qwen3-8B）"
  ```

---

## Task 3: 后端 — schemas/chat.py

**Files:**
- Create: `apps/backend/schemas/chat.py`

> 🖊️ **你来写**：这个文件。参考 `schemas/ocr.py` 的 discriminated union 注释风格。

- [ ] **Step 3.1: 创建 schemas/chat.py**

  需要定义以下类（遵循 `schemas/ocr.py` 的 tagged union 模式）：

  ```
  ChatRequest         —— 请求体，只有 text: str
  ChatBillData        —— type 固定为 "bill"，有 transaction: Transaction
  ChatTextData        —— type 固定为 "text"，有 content: str
  ChatResponse        —— data: ChatBillData | ChatTextData
  ```

  - `Transaction` 从 `schemas.ocr` 导入（`from schemas.ocr import Transaction`）
  - `type` 字段用 `str` 类型 + 默认值（参考 `OcrBillData` 的写法）
  - Python 3.10+ 语法：`ChatBillData | ChatTextData`（不用 `Union`）

- [ ] **Step 3.2: 验证 schema 可导入**

  ```bash
  python -c "from schemas.chat import ChatRequest, ChatResponse, ChatBillData, ChatTextData; print('OK')"
  ```

  预期：`OK`

- [ ] **Step 3.3: Commit**

  ```bash
  git add apps/backend/schemas/chat.py
  git commit -m "feat(backend): 添加 /chat 端点的 Pydantic schema"
  ```

---

## Task 4: 后端 — routers/chat.py

**Files:**
- Create: `apps/backend/routers/chat.py`

> 🖊️ **你来写**：这个文件。逻辑参考 `routers/text.py` 的结构。

- [ ] **Step 4.1: 创建文件，定义 router 和辅助函数**

  文件头部需要：

  ```python
  import re
  from fastapi import APIRouter, Request
  from schemas.chat import ChatRequest, ChatResponse, ChatBillData, ChatTextData
  from schemas.ocr import Transaction
  from services.silicon import (
      classify_intent, extract_bill, generate_sql, summarize_result, chat_reply
  )
  from config import settings
  from supabase import create_client

  router = APIRouter(prefix="/chat", tags=["chat"])
  ```

  复用 `routers/text.py` 中已有的 `get_user_id(request)` 函数（完整拷贝过来，因为它是通用工具）：

  ```python
  def get_user_id(request: Request) -> str | None:
      """从 Authorization header 解码 user_id（不验证签名，只读取 payload）"""
      from jose import jwt
      auth = request.headers.get("Authorization", "")
      if not auth.startswith("Bearer "):
          return None
      token = auth.split(" ")[1]
      try:
          payload = jwt.get_unverified_claims(token)
          return payload.get("sub")
      except Exception:
          return None
  ```

  还需要 SQL 安全校验函数：

  ```python
  def is_safe_sql(sql: str) -> bool:
      stripped = sql.strip().upper()
      return stripped.startswith("SELECT") and not any(
          kw in stripped
          for kw in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]
      )
  ```

- [ ] **Step 4.2: 实现 POST /chat 端点**

  函数签名：

  ```python
  @router.post("", response_model=ChatResponse)
  async def chat(body: ChatRequest, request: Request):
      ...
  ```

  实现逻辑（按顺序）：

  **Step A — 判断意图：**
  ```python
  intent = await classify_intent(body.text)
  ```

  **Step B — record 分支：**
  ```python
  if intent == "record":
      parsed = await extract_bill(body.text)
      if parsed and isinstance(parsed.get("amount"), (int, float)) and parsed["amount"] > 0:
          return ChatResponse(
              data=ChatBillData(
                  transaction=Transaction(
                      amount=float(parsed["amount"]),
                      category=str(parsed.get("category", "其他支出")),
                      note=str(parsed.get("note", "")),
                      type="income" if parsed.get("type") == "income" else "expense",
                      occurred_at=str(parsed.get("occurred_at", "")),
                  )
              )
          )
      return ChatResponse(data=ChatTextData(content="没解析到账单信息，可以试试「手动记账」。"))
  ```

  **Step C — query 分支：**
  ```python
  if intent == "query":
      user_id = get_user_id(request)
      if not user_id:
          return ChatResponse(data=ChatTextData(content="登录状态异常，请重新登录。"))

      sql = await generate_sql(body.text)

      if not is_safe_sql(sql):
          return ChatResponse(data=ChatTextData(content="查询失败，请换个说法。"))

      # 注入 user_id（与 text.py 保持一致：在 WHERE 之后注入）
      sql = re.sub(
          r"WHERE\s+",
          f"WHERE transactions.user_id = '{user_id}' AND ",
          sql,
          flags=re.IGNORECASE,
      )

      supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
      try:
          result = supabase.rpc("exec_readonly_sql", {"sql_text": sql}).execute()
          rows = result.data
      except Exception:
          return ChatResponse(data=ChatTextData(content="查询出错，请稍后再试。"))

      summary = await summarize_result(body.text, rows)
      return ChatResponse(data=ChatTextData(content=summary))
  ```

  **Step D — chat 分支（默认）：**
  ```python
  reply = await chat_reply(body.text)
  return ChatResponse(data=ChatTextData(content=reply))
  ```

  完整函数用 `try/except` 包住整个逻辑，捕获所有未预期异常：
  ```python
  except Exception:
      return ChatResponse(data=ChatTextData(content="处理失败，请稍后再试。"))
  ```

- [ ] **Step 4.3: Commit**

  ```bash
  git add apps/backend/routers/chat.py
  git commit -m "feat(backend): 实现 /chat 端点，支持 record/query/chat 三种意图"
  ```

---

## Task 5: 后端 — 注册路由

**Files:**
- Modify: `apps/backend/routers/__init__.py`

> 🖊️ **你来写**：这两行修改。

- [ ] **Step 5.1: 在 routers/__init__.py 注册 chat router**

  打开 `apps/backend/routers/__init__.py`，仿照已有的三个 router 注册方式，加入 chat router：

  ```python
  from .chat import router as chat_router
  # ...
  all_routers.include_router(chat_router)
  ```

  注意：`main.py` **不需要改**，它只调用 `app.include_router(all_routers)`，所有子路由都在 `__init__.py` 聚合。

- [ ] **Step 5.2: 启动后端验证路由存在**

  ```bash
  cd apps/backend && uvicorn main:app --reload
  ```

  访问 `http://localhost:8000/docs`，确认 `/chat` 出现在 Swagger UI 里。

- [ ] **Step 5.3: 用 curl 手动测试三种意图**

  把 `<TOKEN>` 替换成你的 Supabase JWT（从手机 App 的网络请求里抓）：

  ```bash
  # 测试 record
  curl -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <TOKEN>" \
    -d '{"text": "昨天买咖啡花了28块"}'
  # 预期: {"data": {"type": "bill", "transaction": {...}}}

  # 测试 query
  curl -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <TOKEN>" \
    -d '{"text": "这周花了多少钱"}'
  # 预期: {"data": {"type": "text", "content": "这周花了 ¥..."}}

  # 测试 chat
  curl -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <TOKEN>" \
    -d '{"text": "你好"}'
  # 预期: {"data": {"type": "text", "content": "..."}}
  ```

- [ ] **Step 5.4: Commit**

  ```bash
  git add apps/backend/routers/__init__.py
  git commit -m "feat(backend): 注册 /chat 路由"
  ```

---

## Task 6: 前端 — useChat.ts processText 修改

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`

> 🖊️ **你来写（≥30%）**：下面标注了 `[你来写]` 的部分。其余部分 Claude 提供完整代码。

- [ ] **Step 6.1: 添加 ChatResponse 类型定义 [你来写]**

  在 `useChat.ts` 文件顶部（import 之后），添加类型定义：

  ```typescript
  // [你来写] 参考 ChatBillData / ChatTextData / ChatResponse 后端 schema
  type ChatBillData = {
    type: "bill";
    transaction: {
      amount: number;
      category: string;
      note: string;
      occurred_at: string;
      type: "expense" | "income";
    };
  };

  type ChatTextData = {
    type: "text";
    content: string;
  };

  type ChatResponse = {
    data: ChatBillData | ChatTextData;
  };
  ```

- [ ] **Step 6.2: 修改 processText 的规则引擎未命中分支**

  找到 `useChat.ts` 第 85-92 行（当前代码）：

  ```typescript
  // 2. 规则引擎未命中 → 提示手动记账
  console.log("[processText] ⚠️ 规则引擎未命中，提示手动记账");
  await addMessage({
    role: "assistant",
    content_type: "text",
    content: "没识别到记账信息，可以试试「手动记账」。",
  });
  ```

  替换为以下完整实现：

  ```typescript
  // 2. 规则引擎未命中 → 调用 /chat（SiliconFlow fallback）
  console.log("[processText] ⚠️ 规则引擎未命中，调用 /chat");

  // 2a. 显示思考中占位消息
  const thinkingMsgId = await addMessage({
    role: "assistant",
    content_type: "text",
    content: "思考中...",
  });

  try {
    const resp = await apiFetch<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    console.log("[processText] /chat 返回:", JSON.stringify(resp.data));

    if (resp.data.type === "bill") {
      // 2b-record: 提取到账单 → 创建交易 + 渲染 bill_card
      // [你来写] 参考 sendOcr 函数第 159-202 行的 bill 处理逻辑
      // 步骤：
      //   1. 从 qc.getQueryData<readonly Category[]>(["categories"]) 获取分类列表
      //   2. 用 tx.category + tx.type 匹配分类（fallback 到"其他支出"/"其他收入"）
      //   3. 调 createTransaction({ amount, category_id, type, note, occurred_at, source: "llm" })
      //   4. 调 db.runAsync 把 thinkingMsgId 对应的消息更新成 bill_card
      //      UPDATE chat_messages SET content_type='bill_card', content=?, transaction_id=? WHERE id=?
      //   5. qc.invalidateQueries({ queryKey: ["chat-messages"] })
      const tx = resp.data.transaction;
      const categoriesData = qc.getQueryData<readonly Category[]>(["categories"]);
      const otherName = tx.type === "income" ? "其他收入" : "其他支出";
      const category =
        (tx.category
          ? categoriesData?.find((c) => c.name === tx.category && c.type === tx.type)
          : null) ?? categoriesData?.find((c) => c.name === otherName);

      const occurredAt = tx.occurred_at || new Date().toISOString();
      const txId = await createTransaction({
        amount: tx.amount,
        category_id: category?.id ?? "",
        type: tx.type,
        note: tx.note,
        occurred_at: occurredAt,
        source: "llm",
      });

      // 把占位"思考中"消息更新为 bill_card
      await db!.runAsync(
        "UPDATE chat_messages SET content_type = ?, content = ?, transaction_id = ? WHERE id = ?",
        "bill_card",
        JSON.stringify({
          id: txId,
          amount: tx.amount,
          type: tx.type,
          note: tx.note,
          category_id: category?.id ?? "",
          occurred_at: occurredAt,
        }),
        txId,
        thinkingMsgId,
      );
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    } else {
      // 2b-text: query 结果或闲聊回复 → 更新占位消息内容
      // [你来写] 把 thinkingMsgId 对应的消息内容更新为 resp.data.content
      await db!.runAsync(
        "UPDATE chat_messages SET content = ? WHERE id = ?",
        resp.data.content,
        thinkingMsgId,
      );
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    }
  } catch (err) {
    console.error("[processText] /chat 异常:", err);
    await db!.runAsync(
      "UPDATE chat_messages SET content = ? WHERE id = ?",
      "处理失败，请稍后再试。",
      thinkingMsgId,
    );
    qc.invalidateQueries({ queryKey: ["chat-messages"] });
  }
  ```

  > **注意**：`db` 在 `processText` 的 closure 里不可见（`processText` 没有依赖 `db`）。你需要在 `processText` 的 `useCallback` 依赖数组里加上 `db`：
  > ```typescript
  > }, [qc, addMessage, createTransaction, db]);
  > ```

- [ ] **Step 6.3: 验证 TypeScript 编译无错误 [你来写]**

  ```bash
  cd apps/mobile && npx tsc --noEmit
  ```

  预期：无错误输出。

- [ ] **Step 6.4: 端到端测试**

  启动后端（`docker compose up` 或 `uvicorn main:app --reload`），启动前端（`pnpm dev`）：

  1. 说一句规则引擎**能**识别的话（如"花了30块"）→ 应该直接出账单卡片，**不调 /chat**
  2. 说一句规则引擎**不能**识别的话（如"昨天和朋友去火锅店花了一百多"）→ 应该先出"思考中..."，然后变成账单卡片
  3. 说一句查询语句（如"这周花了多少钱"）→ 应该先出"思考中..."，然后出文字回复
  4. 说一句闲聊（如"你好"）→ 应该出文字回复

- [ ] **Step 6.5: Commit**

  ```bash
  git add apps/mobile/hooks/useChat.ts
  git commit -m "feat(mobile): processText 增加 SiliconFlow /chat fallback"
  ```

---

## 完成检查

- [ ] 后端 `/chat` 在 Swagger UI 可见
- [ ] 三种意图（record / query / chat）均通过 curl 测试
- [ ] 前端规则引擎命中路径**不受影响**（原有账单卡片正常）
- [ ] 前端规则引擎未命中时出现"思考中..."后正确更新气泡
- [ ] 查询语句返回合理的自然语言总结
- [ ] `.env` 中 `SILICON_API_KEY` 已填写，`.env` 不在 git 追踪中
