# Edge Functions 认证策略统一设计

**日期**：2026-03-30
**背景**：`record-ocr` 调用返回 HTTP 401，根因是与已修复的 `record-asr` 401 问题相同——未以 `--no-verify-jwt` 部署，且函数内有冗余的手动 auth 检查。

---

## 问题陈述

新版 Supabase `sb_publishable_` anon key 格式与 Edge Functions 网关的 JWT 验证机制不兼容。解决方式是所有函数部署时加 `--no-verify-jwt`，由函数代码自行决定是否校验用户身份。

当前三个函数认证策略不一致：

| 函数 | 现状 |
|------|------|
| `record-asr` | 无 auth 检查，已 `--no-verify-jwt` 部署 ✅ |
| `record-ocr` | 手动检查 Authorization header，未正确部署 ❌ |
| `record-text` | 手动检查 Authorization header，query 路径额外调用 `getUser` |

---

## 设计目标
****
1. 修复 `record-ocr` HTTP 401
2. 三个函数 auth 策略统一、规则清晰
3. 消除重复的 token 提取代码

---

## 架构

### 新增共享帮助函数

**文件**：`supabase/functions/_shared/auth.ts`

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUserFromRequest(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}
```

- 只有需要 user_id 的路径才调用
- 返回 `null` 表示未认证或 token 无效

---

## 各函数改动

### `record-ocr`

**改动**：删除函数内手动 auth 检查块（约第 63-69 行）。

```diff
-    const authHeader = req.headers.get("Authorization");
-    if (!authHeader) {
-      return new Response(JSON.stringify({ error: "Missing authorization" }), {
-        status: 401,
-        headers: { ...corsHeaders, "Content-Type": "application/json" },
-      });
-    }
+    // 认证由 Supabase API 网关处理（--no-verify-jwt 模式下网关不校验 JWT）
```

理由：OCR 函数不需要 user_id，无需在函数内做 auth 检查。

### `record-text`

**改动 1**：删除函数入口处手动 auth 检查块（约第 100-106 行）。

**改动 2**：query 路径改用共享帮助函数：

```diff
-    const token = authHeader.replace("Bearer ", "");
-    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
-    const { data: { user } } = await supabase.auth.getUser(token);
-    if (!user) {
-      return new Response(JSON.stringify({ error: "Invalid token" }), {
-        status: 401,
-        headers: { ...corsHeaders, "Content-Type": "application/json" },
-      });
-    }
+    const user = await getUserFromRequest(req);
+    if (!user) {
+      return new Response(JSON.stringify({ error: "Invalid token" }), {
+        status: 401,
+        headers: { ...corsHeaders, "Content-Type": "application/json" },
+      });
+    }
```

注意：`createClient` import 和 `SUPABASE_SERVICE_ROLE_KEY` 常量仍需保留，因为 query 路径还需要创建 Supabase 客户端来执行 `supabase.rpc("exec_readonly_sql", ...)` 数据库查询。

### `record-asr`

代码不变，仅重新部署以确保配置明确记录。

---

## 最终 Auth 规则

| 函数 | Auth 策略 | 原因 |
|------|----------|------|
| `record-asr` | 无检查 | 只做语音转文字，无用户数据 |
| `record-ocr` | 无检查 | 只做图像识别，无用户数据 |
| `record-text` (record 路径) | 无检查 | 只调用 GLM，无用户数据 |
| `record-text` (query 路径) | `getUserFromRequest()` → 失败返回 401 | 需要 user_id 过滤数据库查询 |

---

## 部署步骤

```bash
npx supabase functions deploy record-ocr --no-verify-jwt
npx supabase functions deploy record-text --no-verify-jwt
npx supabase functions deploy record-asr --no-verify-jwt
```

---

## 不在范围内

- `record-text` 的 SQL 注入防护（现有 `exec_readonly_sql` RPC 已处理）
- 频率限制（Rate limiting）
- 新增 Edge Function
