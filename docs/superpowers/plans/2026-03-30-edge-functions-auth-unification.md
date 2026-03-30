# Edge Functions 认证策略统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `record-ocr` HTTP 401，并统一三个 Edge Functions 的认证策略——提取共享 auth 帮助函数，所有函数以 `--no-verify-jwt` 部署。

**Architecture:** 新建 `_shared/auth.ts` 封装从请求中提取已验证用户的逻辑；`record-ocr` 和 `record-text` 的冗余 auth 检查块删除；只有 `record-text` 的 query 路径（需要 user_id 过滤数据库）才调用 auth 帮助函数；三个函数统一以 `--no-verify-jwt` 重新部署。

**Tech Stack:** Deno, Supabase Edge Functions, `@supabase/supabase-js@2`, Supabase CLI

---

## 文件变更总览

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `supabase/functions/_shared/auth.ts` | 共享 `getUserFromRequest()` 帮助函数 |
| 修改 | `supabase/functions/record-ocr/index.ts` | 删除手动 auth 检查块（第 63-69 行） |
| 修改 | `supabase/functions/record-text/index.ts` | 删除入口 auth 检查块，query 路径改用共享帮助函数 |
| 不改 | `supabase/functions/record-asr/index.ts` | 代码已是目标状态，仅重新部署 |

---

## Task 1: 新建共享 auth 帮助函数

**Files:**
- Create: `supabase/functions/_shared/auth.ts`

- [ ] **Step 1: 创建 `_shared/auth.ts`**

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUserFromRequest(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/auth.ts
git commit -m "feat: 新增 Edge Functions 共享 auth 帮助函数"
```

---

## Task 2: 修改 `record-ocr` — 删除手动 auth 检查

**Files:**
- Modify: `supabase/functions/record-ocr/index.ts:57-120`

当前第 57-120 行的 `Deno.serve` 处理器中，第 63-69 行有手动 auth 检查块需要删除。

- [ ] **Step 1: 删除 auth 检查块**

找到以下代码块并删除：

```typescript
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

删除后，`Deno.serve` 回调的 `try` 块应直接从解析请求体开始：

```typescript
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ... 后续 OCR 逻辑不变
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/record-ocr/index.ts
git commit -m "fix: record-ocr 移除冗余 auth 检查，认证由网关统一处理"
```

---

## Task 3: 修改 `record-text` — 删除入口 auth 检查并改用共享帮助函数

**Files:**
- Modify: `supabase/functions/record-text/index.ts:94-170`

`record-text` 有两处需要改动：
1. 第 100-106 行：删除入口处的 auth 检查块（record 路径不需要用户身份）
2. 第 151-160 行：query 路径改用共享 `getUserFromRequest()`（并将 `supabase` 客户端移到 user 校验之后）

- [ ] **Step 1: 在文件顶部添加 import**

在第 1 行的 `import { corsHeaders }` 之后添加：

```typescript
import { getUserFromRequest } from "../_shared/auth.ts";
```

完整文件顶部应变为：

```typescript
import { corsHeaders } from "../_shared/cors.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
```

注意：`createClient`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 仍需保留，因为 query 路径还要用 `supabase.rpc()` 执行数据库查询。

- [ ] **Step 2: 删除入口 auth 检查块**

在 `Deno.serve` 的 `try` 块内，找到并删除以下代码：

```typescript
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

删除后，`try` 块直接从读取请求体开始：

```typescript
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      // ...
```

- [ ] **Step 3: 替换 query 路径中的 token 提取和 getUser 调用**

找到 query 路径中以下代码段（位于 `// 2b. 查询` 注释之后）：

```typescript
    // 2b. 查询
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sqlRaw = await callGlm(buildQueryPrompt(text));
    let sql = extractSql(sqlRaw);

    sql = sql.replace(
      /WHERE\s+/i,
      `WHERE transactions.user_id = '${user.id}' AND `,
    );

    const { data: queryResult, error: queryError } = await supabase.rpc("exec_readonly_sql", { sql_text: sql });
```

替换为：

```typescript
    // 2b. 查询
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sqlRaw = await callGlm(buildQueryPrompt(text));
    let sql = extractSql(sqlRaw);

    sql = sql.replace(
      /WHERE\s+/i,
      `WHERE transactions.user_id = '${user.id}' AND `,
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: queryResult, error: queryError } = await supabase.rpc("exec_readonly_sql", { sql_text: sql });
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/record-text/index.ts
git commit -m "fix: record-text 移除冗余 auth 检查，query 路径改用共享 getUserFromRequest"
```

---

## Task 4: 部署三个函数并验证

**注意：** 部署命令需要在项目根目录执行，且需要 Supabase CLI 已登录（`npx supabase login`）。

- [ ] **Step 1: 部署 `record-ocr`**

```bash
npx supabase functions deploy record-ocr --no-verify-jwt
```

预期输出：
```
Bundling record-ocr
...
Deployed Functions record-ocr on project <project-ref>
```

- [ ] **Step 2: 部署 `record-text`**

```bash
npx supabase functions deploy record-text --no-verify-jwt
```

预期输出同上（函数名为 record-text）。

- [ ] **Step 3: 部署 `record-asr`（统一配置，代码无变化）**

```bash
npx supabase functions deploy record-asr --no-verify-jwt
```

- [ ] **Step 4: 在 App 中验证 OCR**

打开 App → 拍照记账 → 上传小票图片。

预期：不再出现 `[sendOcr] ❌ OCR 异常: [Error: HTTP 401]`，正常返回账单卡片或识别失败提示。

- [ ] **Step 5: 验证文字记账仍正常**

在聊天框输入一条无法被规则引擎解析的文字（例如"今天买了一些杂货"），触发 GLM 兜底路径。

预期：返回账单卡片或"没有识别到记账信息"，无 401 错误。

- [ ] **Step 6: 验证语音记账仍正常**

按住麦克风按钮录一段语音，确认 ASR 转文字后正常处理。

预期：无 401 错误。

- [ ] **Step 7: Commit（记录部署完成）**

```bash
git commit --allow-empty -m "chore: 三个 Edge Functions 统一以 --no-verify-jwt 重新部署"
```
