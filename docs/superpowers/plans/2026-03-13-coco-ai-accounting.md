# CoCo AI 记账 App 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 AI 驱动的个人记账 App，通过统一聊天界面融合语音/拍照/文字三种记账方式。

**Architecture:** Turborepo Monorepo，Expo React Native 客户端 + Next.js BFF (Vercel) + Supabase (PostgreSQL/Auth/Storage)。AI 编排层在 BFF 中，调用智谱 GLM + 腾讯云 ASR/OCR。

**Tech Stack:** React Native (Expo), Next.js 14, Supabase, 智谱 AI GLM, 腾讯云 ASR/OCR, Zustand, TanStack Query, Vitest, Turborepo, pnpm

**Spec:** `docs/superpowers/specs/2026-03-13-ai-accounting-design.md`

---

## File Structure

```
coco/
├── apps/
│   ├── mobile/                          # Expo React Native
│   │   ├── app/
│   │   │   ├── _layout.tsx              # Root layout + auth guard
│   │   │   ├── (auth)/login.tsx         # 登录页
│   │   │   ├── (auth)/register.tsx      # 注册页
│   │   │   ├── (tabs)/_layout.tsx       # Tab bar + diamond button
│   │   │   ├── (tabs)/index.tsx         # 首页
│   │   │   ├── (tabs)/stats.tsx         # 统计页
│   │   │   ├── (tabs)/budget.tsx        # 预算页
│   │   │   ├── (tabs)/profile.tsx       # 我的
│   │   │   └── chat.tsx                 # AI 聊天页
│   │   ├── components/
│   │   │   ├── chat/ChatMessage.tsx
│   │   │   ├── chat/BillCard.tsx
│   │   │   ├── chat/ChatInput.tsx
│   │   │   ├── chat/VoiceRecorder.tsx
│   │   │   ├── home/DailySummary.tsx
│   │   │   ├── home/TransactionList.tsx
│   │   │   ├── stats/PieChart.tsx
│   │   │   ├── stats/TrendChart.tsx
│   │   │   ├── budget/BudgetCard.tsx
│   │   │   ├── budget/BudgetForm.tsx
│   │   │   ├── ManualEntryForm.tsx
│   │   │   └── CategoryPicker.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useTransactions.ts
│   │   │   ├── useCategories.ts
│   │   │   ├── useBudgets.ts
│   │   │   └── useChat.ts
│   │   ├── lib/supabase.ts
│   │   ├── lib/api.ts
│   │   └── store/chatStore.ts
│   └── api/                             # Next.js BFF
│       └── src/
│           ├── app/api/
│           │   ├── record/manual/route.ts
│           │   ├── record/text/route.ts
│           │   ├── record/ocr/route.ts
│           │   ├── record/asr/route.ts
│           │   ├── query/nl/route.ts
│           │   ├── transactions/route.ts
│           │   ├── transactions/[id]/route.ts
│           │   ├── categories/route.ts
│           │   ├── categories/[id]/route.ts
│           │   ├── budgets/route.ts
│           │   ├── chat/messages/route.ts
│           │   ├── stats/route.ts
│           │   └── export/route.ts
│           └── lib/
│               ├── supabase.ts
│               ├── auth.ts
│               └── timezone.ts
├── packages/
│   ├── shared/src/
│   │   ├── types/transaction.ts
│   │   ├── types/category.ts
│   │   ├── types/budget.ts
│   │   ├── types/chat.ts
│   │   ├── types/api.ts
│   │   ├── constants/categories.ts
│   │   └── index.ts
│   └── ai/src/
│       ├── glm/client.ts
│       ├── glm/prompts.ts
│       ├── glm/parsers.ts
│       ├── tencent/ocr.ts
│       ├── tencent/asr.ts
│       ├── sql-validator.ts
│       └── index.ts
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Chunk 1: Monorepo 脚手架 + 共享类型 + 数据库

### Task 1: 初始化 Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: 初始化 pnpm workspace**

```bash
pnpm init
```

- [ ] **Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
.expo/
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 5: 创建 .env.example**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 智谱 AI
GLM_API_KEY=

# 腾讯云
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
```

- [ ] **Step 6: 提交**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .env.example
git commit -m "chore: init monorepo with turborepo + pnpm"
```

### Task 2: 创建 shared 包 — 类型定义

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/category.ts`
- Create: `packages/shared/src/types/transaction.ts`
- Create: `packages/shared/src/types/budget.ts`
- Create: `packages/shared/src/types/chat.ts`
- Create: `packages/shared/src/types/api.ts`
- Create: `packages/shared/src/constants/categories.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建 packages/shared/package.json**

```json
{
  "name": "@coco/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建类型文件 — category.ts**

```typescript
export type TransactionType = "income" | "expense";

export interface Category {
  readonly id: string;
  readonly user_id: string | null;
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
  readonly is_default: boolean;
}

export interface CreateCategoryInput {
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
}
```

- [ ] **Step 4: 创建类型文件 — transaction.ts**

```typescript
import type { TransactionType } from "./category";

export type RecordSource = "manual" | "ocr" | "asr" | "text";

export interface Transaction {
  readonly id: string;
  readonly user_id: string;
  readonly category_id: string;
  readonly amount: number;
  readonly type: TransactionType;
  readonly note: string;
  readonly occurred_at: string;
  readonly source: RecordSource;
  readonly raw_input: string | null;
  readonly receipt_url: string | null;
  readonly ai_confidence: number | null;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export interface CreateTransactionInput {
  readonly category_id: string;
  readonly amount: number;
  readonly type: TransactionType;
  readonly note: string;
  readonly occurred_at: string;
  readonly source: RecordSource;
  readonly raw_input?: string;
  readonly receipt_url?: string;
  readonly ai_confidence?: number;
}

export interface UpdateTransactionInput {
  readonly category_id?: string;
  readonly amount?: number;
  readonly type?: TransactionType;
  readonly note?: string;
  readonly occurred_at?: string;
}
```

- [ ] **Step 5: 创建类型文件 — budget.ts**

```typescript
export type BudgetPeriod = "weekly" | "monthly" | "yearly";

export interface Budget {
  readonly id: string;
  readonly user_id: string;
  readonly category_id: string | null;
  readonly amount: number;
  readonly period: BudgetPeriod;
  readonly start_date: string;
}

export interface CreateBudgetInput {
  readonly category_id: string | null;
  readonly amount: number;
  readonly period: BudgetPeriod;
  readonly start_date: string;
}
```

- [ ] **Step 6: 创建类型文件 — chat.ts**

```typescript
export type ChatRole = "user" | "assistant";
export type ChatContentType = "text" | "audio" | "image" | "bill_card" | "nl_result";

export interface ChatMessage {
  readonly id: string;
  readonly user_id: string;
  readonly role: ChatRole;
  readonly content_type: ChatContentType;
  readonly content: string;
  readonly transaction_id: string | null;
  readonly created_at: string;
}
```

- [ ] **Step 7: 创建类型文件 — api.ts**

```typescript
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

export interface PaginatedResponse<T> {
  readonly success: boolean;
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
```

- [ ] **Step 8: 创建 constants/categories.ts**

```typescript
import type { TransactionType } from "../types/category";

export interface DefaultCategory {
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "餐饮", icon: "🍔", type: "expense" },
  { name: "交通", icon: "🚗", type: "expense" },
  { name: "购物", icon: "🛒", type: "expense" },
  { name: "娱乐", icon: "🎮", type: "expense" },
  { name: "居住", icon: "🏠", type: "expense" },
  { name: "医疗", icon: "💊", type: "expense" },
  { name: "教育", icon: "📚", type: "expense" },
  { name: "通讯", icon: "📱", type: "expense" },
  { name: "工资", icon: "💰", type: "income" },
  { name: "理财", icon: "📈", type: "income" },
  { name: "其他收入", icon: "💵", type: "income" },
  { name: "其他支出", icon: "📦", type: "expense" },
] as const;
```

- [ ] **Step 9: 创建 index.ts 导出**

```typescript
export * from "./types/category";
export * from "./types/transaction";
export * from "./types/budget";
export * from "./types/chat";
export * from "./types/api";
export * from "./constants/categories";
```

- [ ] **Step 10: 安装依赖并验证**

```bash
cd packages/shared && pnpm install && pnpm lint
```
Expected: 无 TypeScript 错误

- [ ] **Step 11: 提交**

```bash
git add packages/shared/
git commit -m "feat: add shared types package with category, transaction, budget, chat types"
```

### Task 3: Supabase Schema + RLS + Seed

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/config.toml`

- [ ] **Step 1: 创建 migration 文件**

```sql
-- 001_initial_schema.sql

-- Enums
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE record_source AS ENUM ('manual', 'ocr', 'asr', 'text');
CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');
CREATE TYPE chat_content_type AS ENUM ('text', 'audio', 'image', 'bill_card', 'nl_result');

-- Categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📦',
  type transaction_type NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_default = false);

CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (user_id = auth.uid() AND is_default = false);

CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (user_id = auth.uid() AND is_default = false);

-- Transactions
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  amount numeric(12,2) NOT NULL,
  type transaction_type NOT NULL,
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source record_source NOT NULL DEFAULT 'manual',
  raw_input text,
  receipt_url text,
  ai_confidence real,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select" ON transactions FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "transactions_insert" ON transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions_update" ON transactions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "transactions_delete" ON transactions FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_transactions_user_occurred
  ON transactions (user_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- Budgets
CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id),
  amount numeric(12,2) NOT NULL,
  period budget_period NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_all" ON budgets FOR ALL
  USING (user_id = auth.uid());

-- Chat Messages
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role chat_role NOT NULL,
  content_type chat_content_type NOT NULL DEFAULT 'text',
  content text NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_all" ON chat_messages FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_chat_messages_user_created
  ON chat_messages (user_id, created_at DESC);

-- NL Query Logs
CREATE TABLE nl_query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  generated_sql text NOT NULL,
  result_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nl_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nl_query_logs_all" ON nl_query_logs FOR ALL
  USING (user_id = auth.uid());

-- NL 查询用只读 SQL 执行函数（仅限 service_role 调用）
CREATE OR REPLACE FUNCTION exec_readonly_sql(sql_query text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result json;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION exec_readonly_sql FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_readonly_sql TO service_role;
```

- [ ] **Step 2: 创建 seed.sql（系统预置分类）**

```sql
INSERT INTO categories (user_id, name, icon, type, is_default) VALUES
  (NULL, '餐饮', '🍔', 'expense', true),
  (NULL, '交通', '🚗', 'expense', true),
  (NULL, '购物', '🛒', 'expense', true),
  (NULL, '娱乐', '🎮', 'expense', true),
  (NULL, '居住', '🏠', 'expense', true),
  (NULL, '医疗', '💊', 'expense', true),
  (NULL, '教育', '📚', 'expense', true),
  (NULL, '通讯', '📱', 'expense', true),
  (NULL, '工资', '💰', 'income', true),
  (NULL, '理财', '📈', 'income', true),
  (NULL, '其他收入', '💵', 'income', true),
  (NULL, '其他支出', '📦', 'expense', true);
```

- [ ] **Step 3: 创建 config.toml**

```toml
[api]
enabled = true
port = 54321

[db]
port = 54322

[studio]
enabled = true
port = 54323
```

- [ ] **Step 4: 验证 SQL 语法**

```bash
# 如果已安装 supabase CLI
supabase init # 如果尚未 init
supabase db reset
```
Expected: Migration 执行成功，seed 数据插入 12 条分类

- [ ] **Step 5: 提交**

```bash
git add supabase/
git commit -m "feat: add supabase schema with categories, transactions, budgets, chat_messages, RLS"
```

### Task 4: 创建 AI 服务包脚手架

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/vitest.config.ts`
- Create: `packages/ai/src/index.ts`

- [ ] **Step 1: 创建 packages/ai/package.json**

```json
{
  "name": "@coco/ai",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@coco/shared": "workspace:*",
    "tencentcloud-sdk-nodejs": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json + vitest.config.ts**

tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "__tests__"]
}
```

vitest.config.ts:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: 创建空 index.ts 占位**

```typescript
export {};
```

- [ ] **Step 4: 安装所有依赖**

```bash
cd /path/to/coco && pnpm install
```

- [ ] **Step 5: 提交**

```bash
git add packages/ai/
git commit -m "chore: scaffold ai package with vitest"
```

---

## Chunk 2: AI 服务包 — GLM + 腾讯云 + SQL 校验

### Task 5: GLM Prompt 构建函数 (TDD)

**Files:**
- Create: `packages/ai/src/glm/prompts.ts`
- Create: `packages/ai/__tests__/prompts.test.ts`

- [ ] **Step 1: 写失败测试 — prompts.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import {
  buildOcrExtractPrompt,
  buildAsrExtractPrompt,
  buildIntentClassifyPrompt,
  buildText2SqlPrompt,
  buildSummarizePrompt,
} from "../src/glm/prompts";

describe("buildOcrExtractPrompt", () => {
  it("should include ocr text in prompt", () => {
    const result = buildOcrExtractPrompt("星巴克 拿铁 ¥38.00 2026-03-13");
    expect(result).toContain("星巴克 拿铁 ¥38.00 2026-03-13");
    expect(result).toContain("JSON");
  });
});

describe("buildAsrExtractPrompt", () => {
  it("should include asr text and current time", () => {
    const result = buildAsrExtractPrompt("午饭花了35块", "2026-03-13T12:00:00+08:00");
    expect(result).toContain("午饭花了35块");
    expect(result).toContain("2026-03-13");
  });
});

describe("buildIntentClassifyPrompt", () => {
  it("should include user text", () => {
    const result = buildIntentClassifyPrompt("午饭35");
    expect(result).toContain("午饭35");
    expect(result).toContain("record");
    expect(result).toContain("query");
  });
});

describe("buildText2SqlPrompt", () => {
  it("should include schema info and question", () => {
    const result = buildText2SqlPrompt("上周吃饭花了多少", "2026-03-13T12:00:00+08:00");
    expect(result).toContain("上周吃饭花了多少");
    expect(result).toContain("transactions");
    expect(result).toContain("SELECT");
  });
});

describe("buildSummarizePrompt", () => {
  it("should include query result", () => {
    const result = buildSummarizePrompt("上周吃饭花了多少", '[{"sum": 287.5}]');
    expect(result).toContain("287.5");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd packages/ai && pnpm test
```
Expected: FAIL — module not found

- [ ] **Step 3: 实现 prompts.ts**

```typescript
export function buildOcrExtractPrompt(ocrText: string): string {
  return `从以下 OCR 文本中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string}

规则：
- amount: 金额数值，不含货币符号
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述（如商户名称+商品）
- occurred_at: ISO 8601 格式日期，无法识别则返回 null

只返回 JSON，不要其他文字。

OCR文本：${ocrText}`;
}

export function buildAsrExtractPrompt(asrText: string, currentTime: string): string {
  return `从以下语音转文字内容中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string}

规则：
- amount: 金额数值
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述
- occurred_at: ISO 8601 格式，相对日期（如"昨天""今天"）请基于当前时间计算

当前时间：${currentTime}
只返回 JSON，不要其他文字。

语音内容：${asrText}`;
}

export function buildIntentClassifyPrompt(userText: string): string {
  return `判断以下用户输入的意图，返回 JSON：{"intent": "record"} 或 {"intent": "query"}。
- record：用户在描述一笔消费或收入（如"午饭35"、"打车花了20"、"收到工资5000"）
- query：用户在查询历史数据（如"上周花了多少"、"本月餐饮支出"、"这个月还剩多少预算"）

只返回 JSON，不要其他文字。

用户输入：${userText}`;
}

export function buildText2SqlPrompt(question: string, currentTime: string): string {
  return `将以下自然语言问题转换为 PostgreSQL SELECT 查询。

可用表结构：
- transactions (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, deleted_at)
  - type: 'income' | 'expense'
  - deleted_at IS NULL 表示未删除
- categories (id, user_id, name, icon, type, is_default)

规则：
- 只生成 SELECT 语句
- 必须包含 WHERE deleted_at IS NULL
- 不要包含 user_id 条件（服务端自动注入）
- 使用 JOIN categories ON transactions.category_id = categories.id 来按分类名过滤
- 当前时间：${currentTime}

只返回 SQL，不要其他文字。

问题：${question}`;
}

export function buildSummarizePrompt(question: string, queryResult: string): string {
  return `用户问："${question}"

查询结果如下：
${queryResult}

请用简洁的中文自然语言回答用户的问题。如果结果为空，说"没有找到相关记录"。
包含具体数字和关键细节。`;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd packages/ai && pnpm test
```
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add packages/ai/src/glm/prompts.ts packages/ai/__tests__/prompts.test.ts
git commit -m "feat(ai): add GLM prompt builders with tests"
```

### Task 6: GLM 响应解析器 (TDD)

**Files:**
- Create: `packages/ai/src/glm/parsers.ts`
- Create: `packages/ai/__tests__/parsers.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from "vitest";
import {
  parseRecordResponse,
  parseIntentResponse,
  parseSqlResponse,
} from "../src/glm/parsers";

describe("parseRecordResponse", () => {
  it("should parse valid JSON response", () => {
    const raw = '{"amount": 35, "category": "餐饮", "note": "午饭汉堡", "occurred_at": "2026-03-13T12:00:00"}';
    const result = parseRecordResponse(raw);
    expect(result).toEqual({
      amount: 35,
      category: "餐饮",
      note: "午饭汉堡",
      occurred_at: "2026-03-13T12:00:00",
    });
  });

  it("should extract JSON from markdown code block", () => {
    const raw = '```json\n{"amount": 20, "category": "交通", "note": "打车", "occurred_at": null}\n```';
    const result = parseRecordResponse(raw);
    expect(result?.amount).toBe(20);
  });

  it("should return null for invalid response", () => {
    expect(parseRecordResponse("无法识别")).toBeNull();
  });

  it("should return null if amount is missing", () => {
    expect(parseRecordResponse('{"category": "餐饮"}')).toBeNull();
  });
});

describe("parseIntentResponse", () => {
  it("should parse record intent", () => {
    expect(parseIntentResponse('{"intent": "record"}')).toBe("record");
  });

  it("should parse query intent", () => {
    expect(parseIntentResponse('{"intent": "query"}')).toBe("query");
  });

  it("should default to record for invalid response", () => {
    expect(parseIntentResponse("garbage")).toBe("record");
  });
});

describe("parseSqlResponse", () => {
  it("should extract SQL from response", () => {
    const raw = "```sql\nSELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL\n```";
    expect(parseSqlResponse(raw)).toBe("SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL");
  });

  it("should handle raw SQL without code block", () => {
    const raw = "SELECT COUNT(*) FROM transactions WHERE deleted_at IS NULL";
    expect(parseSqlResponse(raw)).toBe(raw);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd packages/ai && pnpm test
```
Expected: FAIL

- [ ] **Step 3: 实现 parsers.ts**

```typescript
export interface ParsedRecord {
  readonly amount: number;
  readonly category: string;
  readonly note: string;
  readonly occurred_at: string | null;
  readonly type: "income" | "expense";
}

function extractJson(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return raw.trim();
}

export function parseRecordResponse(raw: string): ParsedRecord | null {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
    return {
      amount: parsed.amount,
      category: parsed.category ?? "其他支出",
      note: parsed.note ?? "",
      occurred_at: parsed.occurred_at ?? null,
      type: parsed.type === "income" ? "income" : "expense",
    };
  } catch {
    return null;
  }
}

export function parseIntentResponse(raw: string): "record" | "query" {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    if (parsed.intent === "query") return "query";
    return "record";
  } catch {
    return "record";
  }
}

export function parseSqlResponse(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:sql)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return raw.trim();
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd packages/ai && pnpm test
```
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add packages/ai/src/glm/parsers.ts packages/ai/__tests__/parsers.test.ts
git commit -m "feat(ai): add GLM response parsers with tests"
```

### Task 7: SQL 安全校验器 (TDD)

**Files:**
- Create: `packages/ai/src/sql-validator.ts`
- Create: `packages/ai/__tests__/sql-validator.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from "vitest";
import { validateSql } from "../src/sql-validator";

describe("validateSql", () => {
  it("should allow simple SELECT", () => {
    expect(validateSql("SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL")).toBe(true);
  });

  it("should allow SELECT with JOIN on categories", () => {
    expect(validateSql(
      "SELECT t.amount, c.name FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.deleted_at IS NULL"
    )).toBe(true);
  });

  it("should reject DROP", () => {
    expect(validateSql("DROP TABLE transactions")).toBe(false);
  });

  it("should reject INSERT", () => {
    expect(validateSql("INSERT INTO transactions (amount) VALUES (100)")).toBe(false);
  });

  it("should reject UPDATE", () => {
    expect(validateSql("UPDATE transactions SET amount = 0")).toBe(false);
  });

  it("should reject DELETE", () => {
    expect(validateSql("DELETE FROM transactions")).toBe(false);
  });

  it("should reject queries on non-whitelisted tables", () => {
    expect(validateSql("SELECT * FROM nl_query_logs")).toBe(false);
  });

  it("should reject queries on budgets table", () => {
    expect(validateSql("SELECT * FROM budgets")).toBe(false);
  });

  it("should reject pg_read_file", () => {
    expect(validateSql("SELECT pg_read_file('/etc/passwd')")).toBe(false);
  });

  it("should reject dblink", () => {
    expect(validateSql("SELECT dblink('host=evil', 'SELECT 1')")).toBe(false);
  });

  it("should reject multiple statements", () => {
    expect(validateSql("SELECT 1; DROP TABLE transactions")).toBe(false);
  });

  it("should reject UNION with non-whitelisted table", () => {
    expect(validateSql("SELECT amount FROM transactions UNION SELECT question FROM nl_query_logs")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd packages/ai && pnpm test
```
Expected: FAIL

- [ ] **Step 3: 实现 sql-validator.ts**

```typescript
const ALLOWED_TABLES = ["transactions", "categories"];

const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE",
  "GRANT", "REVOKE", "EXECUTE", "EXEC",
];

const FORBIDDEN_FUNCTIONS = [
  "pg_read_file", "pg_read_binary_file", "pg_ls_dir",
  "dblink", "lo_import", "lo_export",
  "copy", "pg_sleep",
];

export function validateSql(sql: string): boolean {
  const normalized = sql.trim().replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();

  // Must start with SELECT
  if (!upper.startsWith("SELECT")) return false;

  // No multiple statements
  if (normalized.includes(";")) return false;

  // No forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(normalized)) return false;
  }

  // No forbidden functions
  for (const fn of FORBIDDEN_FUNCTIONS) {
    const regex = new RegExp(`\\b${fn}\\b`, "i");
    if (regex.test(normalized)) return false;
  }

  // Extract all table names referenced (FROM, JOIN)
  const tableRefs = normalized.match(/(?:FROM|JOIN)\s+(\w+)/gi) ?? [];
  for (const ref of tableRefs) {
    const tableName = ref.replace(/^(?:FROM|JOIN)\s+/i, "").toLowerCase();
    if (!ALLOWED_TABLES.includes(tableName)) return false;
  }

  return true;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd packages/ai && pnpm test
```
Expected: 12 tests PASS

- [ ] **Step 5: 提交**

```bash
git add packages/ai/src/sql-validator.ts packages/ai/__tests__/sql-validator.test.ts
git commit -m "feat(ai): add SQL security validator with table whitelist and function blacklist"
```

### Task 8: GLM 客户端 + 腾讯云 ASR/OCR 客户端

**Files:**
- Create: `packages/ai/src/glm/client.ts`
- Create: `packages/ai/src/tencent/ocr.ts`
- Create: `packages/ai/src/tencent/asr.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: 实现 GLM client**

```typescript
// packages/ai/src/glm/client.ts

export interface GlmOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

export interface GlmResponse {
  readonly content: string;
}

export async function callGlm(
  prompt: string,
  options: GlmOptions
): Promise<GlmResponse> {
  const { apiKey, model = "glm-4-flash", timeoutMs = 8000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status}`);
    }

    const data = await response.json();
    return { content: data.choices[0].message.content };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: 实现腾讯云 OCR client**

```typescript
// packages/ai/src/tencent/ocr.ts
// 注意：实际接入需安装 tencentcloud-sdk-nodejs，此处为封装层

export interface TencentOcrOptions {
  readonly secretId: string;
  readonly secretKey: string;
  readonly timeoutMs?: number;
}

export interface OcrResult {
  readonly text: string;
  readonly items: readonly OcrItem[];
}

export interface OcrItem {
  readonly name: string;
  readonly value: string;
}

export async function recognizeReceipt(
  imageBase64: string,
  options: TencentOcrOptions
): Promise<OcrResult> {
  // 动态导入腾讯云 SDK，避免在客户端打包
  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const OcrClient = tencentcloud.ocr.v20181119.Client;

  const client = new OcrClient({
    credential: { secretId: options.secretId, secretKey: options.secretKey },
    region: "ap-guangzhou",
  });

  // 使用通用文字识别（支持小票、外卖截图等日常场景，不限于增值税发票）
  const resp = await client.GeneralBasicOCR({ ImageBase64: imageBase64 });

  const items: OcrItem[] = (resp.TextDetections ?? []).map((det: any) => ({
    name: "text",
    value: det.DetectedText ?? "",
  }));

  const text = items.map((i) => i.value).join("\n");
  return { text, items };
}
```

- [ ] **Step 3: 实现腾讯云 ASR client**

```typescript
// packages/ai/src/tencent/asr.ts

export interface TencentAsrOptions {
  readonly secretId: string;
  readonly secretKey: string;
  readonly timeoutMs?: number;
}

export interface AsrResult {
  readonly text: string;
}

export async function recognizeSpeech(
  audioBase64: string,
  options: TencentAsrOptions
): Promise<AsrResult> {
  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const AsrClient = tencentcloud.asr.v20190614.Client;

  const client = new AsrClient({
    credential: { secretId: options.secretId, secretKey: options.secretKey },
    region: "ap-guangzhou",
  });

  const resp = await client.SentenceRecognition({
    EngSerViceType: "16k_zh",
    SourceType: 1,
    VoiceFormat: "wav",
    Data: audioBase64,
    DataLen: Buffer.from(audioBase64, "base64").length,
  });

  return { text: resp.Result ?? "" };
}
```

- [ ] **Step 4: 更新 index.ts 导出**

```typescript
// packages/ai/src/index.ts
export { callGlm, type GlmOptions, type GlmResponse } from "./glm/client";
export {
  buildOcrExtractPrompt,
  buildAsrExtractPrompt,
  buildIntentClassifyPrompt,
  buildText2SqlPrompt,
  buildSummarizePrompt,
} from "./glm/prompts";
export {
  parseRecordResponse,
  parseIntentResponse,
  parseSqlResponse,
  type ParsedRecord,
} from "./glm/parsers";
export { validateSql } from "./sql-validator";
export { recognizeReceipt, type OcrResult } from "./tencent/ocr";
export { recognizeSpeech, type AsrResult } from "./tencent/asr";
```

- [ ] **Step 5: 验证构建**

```bash
cd packages/ai && pnpm lint
```
Expected: 无 TypeScript 错误

- [ ] **Step 6: 提交**

```bash
git add packages/ai/src/
git commit -m "feat(ai): add GLM client, Tencent OCR/ASR clients, export barrel"
```

---

## Chunk 3: BFF API 层（Auth + CRUD + AI 端点）

### Task 9: 初始化 Next.js BFF 项目

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/next.config.ts`
- Create: `apps/api/src/lib/supabase.ts`
- Create: `apps/api/src/lib/auth.ts`
- Create: `apps/api/src/lib/timezone.ts`

- [ ] **Step 1: 创建 apps/api/package.json**

```json
{
  "name": "@coco/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@coco/ai": "workspace:*",
    "@coco/shared": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tencentcloud-sdk-nodejs": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coco/shared", "@coco/ai"],
};

export default nextConfig;
```

- [ ] **Step 4: 创建 Supabase 服务端客户端**

```typescript
// apps/api/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function createAuthClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
```

- [ ] **Step 5: 创建 Auth 中间件工具**

```typescript
// apps/api/src/lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "./supabase";
import type { ApiResponse } from "@coco/shared";

export async function authenticateRequest(
  req: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, data: null, error: "Missing auth token" } satisfies ApiResponse<null>,
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json(
      { success: false, data: null, error: "Invalid token" } satisfies ApiResponse<null>,
      { status: 401 }
    );
  }

  return { userId: data.user.id };
}
```

- [ ] **Step 6: 创建时区工具**

```typescript
// apps/api/src/lib/timezone.ts
import { NextRequest } from "next/server";

export function getTimezone(req: NextRequest): string {
  return req.headers.get("X-Timezone") ?? "Asia/Shanghai";
}

export function getCurrentTimeInZone(timezone: string): string {
  return new Date().toLocaleString("sv-SE", { timeZone: timezone }).replace(" ", "T");
}
```

- [ ] **Step 7: 安装依赖并验证**

```bash
cd /path/to/coco && pnpm install && cd apps/api && pnpm lint
```
Expected: 无错误

- [ ] **Step 8: 提交**

```bash
git add apps/api/
git commit -m "feat(api): scaffold Next.js BFF with auth, supabase, timezone utils"
```

### Task 10: Categories CRUD API

**Files:**
- Create: `apps/api/src/app/api/categories/route.ts`
- Create: `apps/api/src/app/api/categories/[id]/route.ts`

- [ ] **Step 1: 实现 GET + POST /api/categories**

```typescript
// apps/api/src/app/api/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { ApiResponse, Category, CreateCategoryInput } from "@coco/shared";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data, error: null } satisfies ApiResponse<Category[]>);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateCategoryInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...body, user_id: auth.userId, is_default: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data, error: null } satisfies ApiResponse<Category>,
    { status: 201 }
  );
}
```

- [ ] **Step 2: 实现 PATCH + DELETE /api/categories/[id]**

```typescript
// apps/api/src/app/api/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { ApiResponse, Category } from "@coco/shared";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("categories")
    .update(body)
    .eq("id", params.id)
    .eq("is_default", false)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data, error: null } satisfies ApiResponse<Category>);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", params.id)
    .eq("is_default", false);

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: null, error: null } satisfies ApiResponse<null>);
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/app/api/categories/
git commit -m "feat(api): add categories CRUD endpoints"
```

### Task 11: Transactions CRUD + Chat Messages + Stats + Export API

**Files:**
- Create: `apps/api/src/app/api/transactions/route.ts`
- Create: `apps/api/src/app/api/transactions/[id]/route.ts`
- Create: `apps/api/src/app/api/chat/messages/route.ts`
- Create: `apps/api/src/app/api/stats/route.ts`
- Create: `apps/api/src/app/api/budgets/route.ts`
- Create: `apps/api/src/app/api/export/route.ts`

- [ ] **Step 1: 实现 GET + POST /api/transactions**

```typescript
// apps/api/src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { PaginatedResponse, Transaction, CreateTransactionInput } from "@coco/shared";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = (page - 1) * limit;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error, count } = await supabase
    .from("transactions")
    .select("*, categories(name, icon)", { count: "exact" })
    .eq("user_id", auth.userId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, data: [], total: 0, page, limit } satisfies PaginatedResponse<never>,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true, data: data ?? [], total: count ?? 0, page, limit,
  } satisfies PaginatedResponse<Transaction>);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateTransactionInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...body, user_id: auth.userId })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data, error: null }, { status: 201 });
}
```

- [ ] **Step 2: 实现 PATCH + DELETE /api/transactions/[id]**

```typescript
// apps/api/src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  // 过滤允许更新的字段，防止覆盖敏感字段
  const { amount, category_id, note, type, occurred_at } = body;
  const safeBody = { amount, category_id, note, type, occurred_at };

  const { data, error } = await supabase
    .from("transactions")
    .update(safeBody)
    .eq("id", params.id)
    .eq("user_id", auth.userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data, error: null });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  // 软删除（含 user_id 验证）
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: null, error: null });
}
```

- [ ] **Step 3: 实现 GET /api/chat/messages**

```typescript
// apps/api/src/app/api/chat/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = (page - 1) * limit;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error, count } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, data: [], total: 0, page, limit },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, limit });
}
```

- [ ] **Step 4: 实现 GET /api/stats**

```typescript
// apps/api/src/app/api/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "monthly";
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");

  const supabase = createServiceClient();

  let query = supabase
    .from("transactions")
    .select("amount, type, category_id, categories(name, icon), occurred_at")
    .eq("user_id", auth.userId)
    .is("deleted_at", null);

  if (startDate) query = query.gte("occurred_at", startDate);
  if (endDate) query = query.lte("occurred_at", endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  const totalIncome = (data ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = (data ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryMap = (data ?? []).reduce<Record<string, { name: string; icon: string; amount: number; type: string }>>((acc, t) => {
    const cat = (t as any).categories;
    const key = t.category_id;
    if (!acc[key]) acc[key] = { name: cat?.name ?? "未知", icon: cat?.icon ?? "📦", amount: 0, type: t.type };
    acc[key].amount += Number(t.amount);
    return acc;
  }, {});

  const categoryBreakdown = Object.values(categoryMap)
    .sort((a, b) => b.amount - a.amount)
    .map((cat) => ({
      ...cat,
      percentage: totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0,
    }));

  return NextResponse.json({
    success: true,
    data: { totalIncome, totalExpense, balance: totalIncome - totalExpense, categoryBreakdown },
    error: null,
  });
}
```

- [ ] **Step 5: 实现 GET + POST /api/budgets**

```typescript
// apps/api/src/app/api/budgets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { CreateBudgetInput } from "@coco/shared";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("*, categories(name, icon)")
    .order("created_at");

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  // 计算每个预算分类的已花金额
  const now = new Date();
  const budgetsWithSpent = await Promise.all(
    (budgets ?? []).map(async (budget) => {
      const periodStart = new Date(now);
      if (budget.period === "weekly") periodStart.setDate(now.getDate() - 7);
      else if (budget.period === "monthly") periodStart.setMonth(now.getMonth() - 1);
      else periodStart.setFullYear(now.getFullYear() - 1);

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount")
        .eq("category_id", budget.category_id)
        .eq("type", "expense")
        .is("deleted_at", null)
        .gte("occurred_at", periodStart.toISOString());

      const spent = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
      return { ...budget, spent };
    })
  );

  return NextResponse.json({ success: true, data: budgetsWithSpent, error: null });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateBudgetInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  // Upsert: unique on (user_id, category_id, period)
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { ...body, user_id: auth.userId },
      { onConflict: "user_id,category_id,period" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data, error: null }, { status: 201 });
}
```

- [ ] **Step 6: 实现 GET /api/export**

```typescript
// apps/api/src/app/api/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");

  const supabase = createServiceClient();

  let query = supabase
    .from("transactions")
    .select("amount, type, note, occurred_at, source, categories(name)")
    .eq("user_id", auth.userId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  if (startDate) query = query.gte("occurred_at", startDate);
  if (endDate) query = query.lte("occurred_at", endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  const csvHeader = "日期,类型,分类,金额,备注,来源";
  const csvRows = (data ?? []).map((t) => {
    const cat = (t as any).categories?.name ?? "未知";
    const typeLabel = t.type === "income" ? "收入" : "支出";
    return `${t.occurred_at},${typeLabel},${cat},${t.amount},${t.note},${t.source}`;
  });

  const csv = [csvHeader, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=coco-export.csv",
    },
  });
}
```

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/app/api/
git commit -m "feat(api): add transactions, budgets, chat, stats, export CRUD endpoints"
```

### Task 12: AI 记账端点（manual, text, ocr, asr, nl）

**Files:**
- Create: `apps/api/src/app/api/record/manual/route.ts`
- Create: `apps/api/src/app/api/record/text/route.ts`
- Create: `apps/api/src/app/api/record/ocr/route.ts`
- Create: `apps/api/src/app/api/record/asr/route.ts`
- Create: `apps/api/src/app/api/query/nl/route.ts`

- [ ] **Step 1: 实现 POST /api/record/manual**

```typescript
// apps/api/src/app/api/record/manual/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { CreateTransactionInput } from "@coco/shared";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateTransactionInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  // 插入 transaction
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({ ...body, user_id: auth.userId, source: "manual" })
    .select("*, categories(name, icon)")
    .single();

  if (txError) {
    return NextResponse.json({ success: false, data: null, error: txError.message }, { status: 500 });
  }

  // 插入聊天消息（用户 + AI 回复）
  await supabase.from("chat_messages").insert([
    { user_id: auth.userId, role: "user", content_type: "text", content: `手动记账: ${body.note} ¥${body.amount}` },
    { user_id: auth.userId, role: "assistant", content_type: "bill_card", content: JSON.stringify(tx), transaction_id: tx.id },
  ]);

  return NextResponse.json({ success: true, data: tx, error: null }, { status: 201 });
}
```

- [ ] **Step 2: 实现 POST /api/record/text**

```typescript
// apps/api/src/app/api/record/text/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient, createServiceClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import {
  callGlm,
  buildIntentClassifyPrompt,
  buildAsrExtractPrompt,
  buildText2SqlPrompt,
  buildSummarizePrompt,
  parseIntentResponse,
  parseRecordResponse,
  parseSqlResponse,
  validateSql,
} from "@coco/ai";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { text } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const glmOptions = { apiKey: process.env.GLM_API_KEY! };
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);

  // 保存用户消息
  await supabase.from("chat_messages").insert({
    user_id: auth.userId, role: "user", content_type: "text", content: text,
  });

  // Step 1: 意图分类
  const intentResp = await callGlm(buildIntentClassifyPrompt(text), glmOptions);
  const intent = parseIntentResponse(intentResp.content);

  if (intent === "query") {
    // 转入 NL 查询
    try {
      const sqlResp = await callGlm(buildText2SqlPrompt(text, now), glmOptions);
      const sql = parseSqlResponse(sqlResp.content);

      if (!validateSql(sql)) {
        await supabase.from("chat_messages").insert({
          user_id: auth.userId, role: "assistant", content_type: "text",
          content: "无法理解你的问题，请换个问法试试。",
        });
        return NextResponse.json({ success: true, data: { type: "nl_error", message: "无法理解，请换个问法" }, error: null });
      }

      // 安全注入 user_id：验证 UUID 格式后注入
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(auth.userId)) {
        return NextResponse.json({ success: false, data: null, error: "Invalid user" }, { status: 403 });
      }

      // 将 GLM 生成的 SQL 包装在 CTE 中强制 user_id 过滤
      const wrappedSql = `WITH scoped AS (SELECT * FROM transactions WHERE user_id = '${auth.userId}' AND deleted_at IS NULL) ${sql.replace(/\btransactions\b/gi, "scoped")}`;

      const serviceClient = createServiceClient();
      const { data: queryResult } = await serviceClient.rpc("exec_readonly_sql", { sql_query: wrappedSql });

      const summaryResp = await callGlm(
        buildSummarizePrompt(text, JSON.stringify(queryResult ?? [])),
        glmOptions
      );

      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "nl_result", content: summaryResp.content,
      });

      // 记录 NL 查询日志
      await createServiceClient().from("nl_query_logs").insert({
        user_id: auth.userId, question: text, generated_sql: sql, result_summary: summaryResp.content,
      });

      return NextResponse.json({ success: true, data: { type: "nl_result", message: summaryResp.content }, error: null });
    } catch {
      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "text", content: "查询失败，请稍后重试。",
      });
      return NextResponse.json({ success: false, data: null, error: "NL query failed" }, { status: 500 });
    }
  }

  // Step 2: 记账意图 → 解析
  try {
    const extractResp = await callGlm(buildAsrExtractPrompt(text, now), glmOptions);
    const parsed = parseRecordResponse(extractResp.content);

    if (!parsed) {
      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "text", content: "没听懂，要不换个说法？或者试试手动记账。",
      });
      return NextResponse.json({ success: true, data: { type: "parse_error" }, error: null });
    }

    // 查找匹配分类
    const { data: categories } = await supabase.from("categories").select("id, name");
    const matchedCat = (categories ?? []).find((c) => c.name === parsed.category);
    const categoryId = matchedCat?.id ?? (categories ?? []).find((c) => c.name === "其他支出")?.id;

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: auth.userId,
        category_id: categoryId,
        amount: parsed.amount,
        type: parsed.type,
        note: parsed.note,
        occurred_at: parsed.occurred_at ?? new Date().toISOString(),
        source: "text",
        raw_input: text,
        ai_confidence: 0.8,
      })
      .select("*, categories(name, icon)")
      .single();

    if (txError) {
      return NextResponse.json({ success: false, data: null, error: txError.message }, { status: 500 });
    }

    await supabase.from("chat_messages").insert({
      user_id: auth.userId, role: "assistant", content_type: "bill_card",
      content: JSON.stringify(tx), transaction_id: tx.id,
    });

    return NextResponse.json({ success: true, data: { type: "bill", transaction: tx }, error: null }, { status: 201 });
  } catch {
    await supabase.from("chat_messages").insert({
      user_id: auth.userId, role: "assistant", content_type: "text", content: "识别失败，请手动记账。",
    });
    return NextResponse.json({ success: false, data: null, error: "Parse failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: 实现 POST /api/record/ocr**

```typescript
// apps/api/src/app/api/record/ocr/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { callGlm, buildOcrExtractPrompt, parseRecordResponse, recognizeReceipt } from "@coco/ai";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { imageBase64 } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const tz = getTimezone(req);

  // 保存用户图片消息
  await supabase.from("chat_messages").insert({
    user_id: auth.userId, role: "user", content_type: "image", content: "[receipt image]",
  });

  try {
    // Step 1: 腾讯云 OCR
    const ocrResult = await recognizeReceipt(imageBase64, {
      secretId: process.env.TENCENT_SECRET_ID!,
      secretKey: process.env.TENCENT_SECRET_KEY!,
    });

    // Step 2: GLM 提取
    const glmResp = await callGlm(buildOcrExtractPrompt(ocrResult.text), { apiKey: process.env.GLM_API_KEY! });
    const parsed = parseRecordResponse(glmResp.content);

    if (!parsed) {
      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "text", content: "小票识别失败，请手动记账。",
      });
      return NextResponse.json({ success: true, data: { type: "parse_error" }, error: null });
    }

    // 查找分类
    const { data: categories } = await supabase.from("categories").select("id, name");
    const matchedCat = (categories ?? []).find((c) => c.name === parsed.category);
    const categoryId = matchedCat?.id ?? (categories ?? []).find((c) => c.name === "其他支出")?.id;

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: auth.userId, category_id: categoryId, amount: parsed.amount,
        type: parsed.type, note: parsed.note,
        occurred_at: parsed.occurred_at ?? new Date().toISOString(),
        source: "ocr", raw_input: ocrResult.text, ai_confidence: 0.75,
      })
      .select("*, categories(name, icon)")
      .single();

    if (txError) {
      return NextResponse.json({ success: false, data: null, error: txError.message }, { status: 500 });
    }

    await supabase.from("chat_messages").insert({
      user_id: auth.userId, role: "assistant", content_type: "bill_card",
      content: JSON.stringify(tx), transaction_id: tx.id,
    });

    return NextResponse.json({ success: true, data: { type: "bill", transaction: tx }, error: null }, { status: 201 });
  } catch {
    await supabase.from("chat_messages").insert({
      user_id: auth.userId, role: "assistant", content_type: "text", content: "OCR 识别失败，请手动记账。",
    });
    return NextResponse.json({ success: false, data: null, error: "OCR failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 实现 POST /api/record/asr**

```typescript
// apps/api/src/app/api/record/asr/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { callGlm, buildAsrExtractPrompt, parseRecordResponse, recognizeSpeech } from "@coco/ai";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { audioBase64 } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);

  // 保存用户语音消息
  await supabase.from("chat_messages").insert({
    user_id: auth.userId, role: "user", content_type: "audio", content: "[voice message]",
  });

  try {
    // Step 1: 腾讯云 ASR
    const asrResult = await recognizeSpeech(audioBase64, {
      secretId: process.env.TENCENT_SECRET_ID!,
      secretKey: process.env.TENCENT_SECRET_KEY!,
    });

    // Step 2: GLM 解析
    const glmResp = await callGlm(buildAsrExtractPrompt(asrResult.text, now), { apiKey: process.env.GLM_API_KEY! });
    const parsed = parseRecordResponse(glmResp.content);

    if (!parsed) {
      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "text", content: "没听清，要不再说一次？",
      });
      return NextResponse.json({ success: true, data: { type: "parse_error" }, error: null });
    }

    const { data: categories } = await supabase.from("categories").select("id, name");
    const matchedCat = (categories ?? []).find((c) => c.name === parsed.category);
    const categoryId = matchedCat?.id ?? (categories ?? []).find((c) => c.name === "其他支出")?.id;

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: auth.userId, category_id: categoryId, amount: parsed.amount,
        type: parsed.type, note: parsed.note,
        occurred_at: parsed.occurred_at ?? new Date().toISOString(),
        source: "asr", raw_input: asrResult.text, ai_confidence: 0.7,
      })
      .select("*, categories(name, icon)")
      .single();

    if (txError) {
      return NextResponse.json({ success: false, data: null, error: txError.message }, { status: 500 });
    }

    await supabase.from("chat_messages").insert({
      user_id: auth.userId, role: "assistant", content_type: "bill_card",
      content: JSON.stringify(tx), transaction_id: tx.id,
    });

    return NextResponse.json({ success: true, data: { type: "bill", transaction: tx }, error: null }, { status: 201 });
  } catch {
    await supabase.from("chat_messages").insert({
      user_id: auth.userId, role: "assistant", content_type: "text", content: "语音识别失败，请手动记账。",
    });
    return NextResponse.json({ success: false, data: null, error: "ASR failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: 实现 POST /api/query/nl**

```typescript
// apps/api/src/app/api/query/nl/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient, createServiceClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { callGlm, buildText2SqlPrompt, buildSummarizePrompt, parseSqlResponse, validateSql } from "@coco/ai";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { question } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);
  const glmOptions = { apiKey: process.env.GLM_API_KEY! };

  try {
    const sqlResp = await callGlm(buildText2SqlPrompt(question, now), glmOptions);
    const sql = parseSqlResponse(sqlResp.content);

    if (!validateSql(sql)) {
      return NextResponse.json({
        success: true, data: { message: "无法理解你的问题，请换个问法。" }, error: null,
      });
    }

    // 验证 UUID 格式防止注入
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(auth.userId)) {
      return NextResponse.json({ success: false, data: null, error: "Invalid user" }, { status: 403 });
    }

    // CTE 包装：用 scoped 替换 transactions 强制 user_id 过滤
    const wrappedSql = `WITH scoped AS (SELECT * FROM transactions WHERE user_id = '${auth.userId}' AND deleted_at IS NULL) ${sql.replace(/\btransactions\b/gi, "scoped")}`;

    const serviceClient = createServiceClient();
    const { data: queryResult, error: queryError } = await serviceClient.rpc("exec_readonly_sql", {
      sql_query: wrappedSql,
    });

    if (queryError) {
      return NextResponse.json({ success: false, data: null, error: queryError.message }, { status: 500 });
    }

    const summaryResp = await callGlm(
      buildSummarizePrompt(question, JSON.stringify(queryResult ?? [])),
      glmOptions
    );

    // 保存日志
    await createServiceClient().from("nl_query_logs").insert({
      user_id: auth.userId, question, generated_sql: sql, result_summary: summaryResp.content,
    });

    return NextResponse.json({
      success: true, data: { message: summaryResp.content }, error: null,
    });
  } catch {
    return NextResponse.json({ success: false, data: null, error: "Query failed" }, { status: 500 });
  }
}
```

- [ ] **Step 6: 提交**

```bash
git add apps/api/src/app/api/record/ apps/api/src/app/api/query/
git commit -m "feat(api): add AI record endpoints (manual, text, ocr, asr) and NL query"
```

---

## Chunk 4: 移动端基础（Expo + Auth + Tab Bar + 首页）

### Task 13: 初始化 Expo 项目

**Files:**
- Create: `apps/mobile/` (via `npx create-expo-app`)
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/api.ts`

- [ ] **Step 1: 创建 Expo 项目**

```bash
cd apps && npx create-expo-app mobile --template tabs
```

- [ ] **Step 2: 安装依赖**

```bash
cd apps/mobile && npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-camera expo-av expo-image-picker expo-localization expo-file-system expo-linear-gradient && pnpm add @tanstack/react-query zustand @coco/shared
```

- [ ] **Step 3: 创建 Supabase 客户端**

```typescript
// apps/mobile/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-url-polyfill/auto";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true } }
);
```

- [ ] **Step 4: 创建 API 工具**

```typescript
// apps/mobile/lib/api.ts
import { supabase } from "./supabase";
import * as Localization from "expo-localization";

const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "X-Timezone": Localization.timezone ?? "Asia/Shanghai",
      ...options?.headers,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? `HTTP ${response.status}`);
  }
  return json;
}
```

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/package.json apps/mobile/tsconfig.json apps/mobile/app.json apps/mobile/lib/supabase.ts apps/mobile/lib/api.ts apps/mobile/app/
git commit -m "feat(mobile): init expo project with supabase + api client"
```

### Task 14: Auth 页面（登录/注册）

**Files:**
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/register.tsx`
- Create: `apps/mobile/hooks/useAuth.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: 创建 useAuth hook**

```typescript
// apps/mobile/hooks/useAuth.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, signIn, signUp, signOut };
}
```

- [ ] **Step 2: 创建登录页**

```typescript
// apps/mobile/app/(auth)/login.tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();

  const handleLogin = async () => {
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("登录失败", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✦ CoCo AI</Text>
      <TextInput style={styles.input} placeholder="邮箱" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>登录</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.link}>没有账号？去注册</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0f172a" },
  title: { fontSize: 32, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 40 },
  input: { backgroundColor: "#1e293b", color: "#fff", padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: "#6366f1", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#818cf8", textAlign: "center", marginTop: 16 },
});
```

- [ ] **Step 3: 创建注册页**

```typescript
// apps/mobile/app/(auth)/register.tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { router } from "expo-router";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert("注册失败", "两次密码不一致");
      return;
    }
    try {
      await signUp(email, password);
      Alert.alert("注册成功", "请检查邮箱完成验证", [
        { text: "好的", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (e: any) {
      Alert.alert("注册失败", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>创建账号</Text>
      <TextInput style={styles.input} placeholder="邮箱" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#64748b" />
      <TextInput style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#64748b" />
      <TextInput style={styles.input} placeholder="确认密码" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor="#64748b" />
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>注册</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>已有账号？去登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0f172a" },
  title: { fontSize: 32, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 40 },
  input: { backgroundColor: "#1e293b", color: "#fff", padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: "#6366f1", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#818cf8", textAlign: "center", marginTop: 16 },
});
```

- [ ] **Step 4: 修改根 _layout.tsx 加 auth guard**

```typescript
// apps/mobile/app/_layout.tsx
import { Slot, router } from "expo-router";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/(auth)/login");
    if (!loading && session) router.replace("/(tabs)");
  }, [session, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
        <Text style={{ color: "#818cf8", fontSize: 24, fontWeight: "800" }}>✦ CoCo AI</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/app/ apps/mobile/hooks/useAuth.ts
git commit -m "feat(mobile): add auth screens and root layout with auth guard"
```

### Task 15: Tab Bar（含菱形 AI 按钮）

**Files:**
- Create: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: 实现 Tab Bar layout**

```typescript
// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

function DiamondButton() {
  return (
    <TouchableOpacity style={styles.diamondWrapper} onPress={() => router.push("/chat")}>
      <LinearGradient colors={["#f59e0b", "#ef4444"]} style={styles.diamond}>
        <View style={styles.diamondInner}>
          <Text style={styles.diamondText}>✦ AI</Text>
        </View>
      </LinearGradient>
      <Text style={styles.diamondLabel}>记账</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji }: { emoji: string }) {
  return (
    <View>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: "#1e293b", borderTopColor: "#334155", height: 60, paddingBottom: 8 },
      tabBarActiveTintColor: "#818cf8",
      tabBarInactiveTintColor: "#94a3b8",
      headerShown: false,
    }}>
      <Tabs.Screen name="index" options={{ title: "首页", tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
      <Tabs.Screen name="stats" options={{ title: "统计", tabBarIcon: () => <TabIcon emoji="📊" /> }} />
      <Tabs.Screen name="ai-placeholder" options={{
        title: "",
        tabBarButton: () => <DiamondButton />,
      }} />
      <Tabs.Screen name="budget" options={{ title: "预算", tabBarIcon: () => <TabIcon emoji="🎯" /> }} />
      <Tabs.Screen name="profile" options={{ title: "我的", tabBarIcon: () => <TabIcon emoji="👤" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  diamondWrapper: { top: -20, justifyContent: "center", alignItems: "center" },
  diamond: {
    width: 56, height: 56, borderRadius: 16, transform: [{ rotate: "45deg" }],
    backgroundColor: "#f59e0b", justifyContent: "center", alignItems: "center",
    shadowColor: "#f59e0b", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
    elevation: 8,
  },
  diamondInner: { transform: [{ rotate: "-45deg" }], alignItems: "center" },
  diamondText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  diamondLabel: { color: "#fbbf24", fontSize: 9, fontWeight: "600", marginTop: 3 },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): add tab bar with diamond AI button"
```

### Task 16: 首页（今日收支 + 最近账单）

**Files:**
- Create: `apps/mobile/hooks/useTransactions.ts`
- Create: `apps/mobile/components/home/DailySummary.tsx`
- Create: `apps/mobile/components/home/TransactionList.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: 创建 useTransactions hook**

```typescript
// apps/mobile/hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { PaginatedResponse, Transaction, ApiResponse } from "@coco/shared";

export function useTransactions(page = 1) {
  return useQuery({
    queryKey: ["transactions", page],
    queryFn: () => apiFetch<PaginatedResponse<Transaction>>(`/api/transactions?page=${page}&limit=20`),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<ApiResponse<null>>(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}
```

- [ ] **Step 2: 创建 DailySummary 组件**

```typescript
// apps/mobile/components/home/DailySummary.tsx
import { View, Text, StyleSheet } from "react-native";
import type { Transaction } from "@coco/shared";

interface Props {
  readonly transactions: readonly Transaction[];
}

export function DailySummary({ transactions }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const todayTxs = transactions.filter((t) => t.occurred_at.slice(0, 10) === today);
  const income = todayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = todayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>今日收支</Text>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.label}>收入</Text>
          <Text style={[styles.amount, { color: "#22c55e" }]}>+¥{income.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>支出</Text>
          <Text style={[styles.amount, { color: "#ef4444" }]}>-¥{expense.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>结余</Text>
          <Text style={styles.amount}>¥{(income - expense).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, marginTop: 0, backgroundColor: "#1e293b", borderRadius: 16, padding: 16 },
  title: { color: "#94a3b8", fontSize: 12, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-around" },
  item: { alignItems: "center" },
  label: { color: "#64748b", fontSize: 11, marginBottom: 4 },
  amount: { color: "#fff", fontSize: 18, fontWeight: "700" },
  divider: { width: 1, backgroundColor: "#334155" },
});
```

- [ ] **Step 3: 创建 TransactionList 组件**

```typescript
// apps/mobile/components/home/TransactionList.tsx
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { Transaction } from "@coco/shared";

interface Props {
  readonly transactions: readonly Transaction[];
  readonly isLoading: boolean;
}

export function TransactionList({ transactions, isLoading }: Props) {
  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color="#818cf8" />;
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.left}>
            <Text style={styles.icon}>{item.categories?.icon ?? "📦"}</Text>
            <View>
              <Text style={styles.category}>{item.categories?.name ?? "未分类"}</Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
          </View>
          <Text style={[styles.amount, { color: item.type === "expense" ? "#ef4444" : "#22c55e" }]}>
            {item.type === "expense" ? "-" : "+"}¥{item.amount.toFixed(2)}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>暂无记录</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16 },
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 24 },
  category: { color: "#fff", fontSize: 14, fontWeight: "600" },
  note: { color: "#64748b", fontSize: 11, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "700" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});
```

- [ ] **Step 4: 实现首页**

```typescript
// apps/mobile/app/(tabs)/index.tsx
import { View, StyleSheet, TextInput } from "react-native";
import { DailySummary } from "../../components/home/DailySummary";
import { TransactionList } from "../../components/home/TransactionList";
import { useTransactions } from "../../hooks/useTransactions";

export default function HomeScreen() {
  const { data, isLoading } = useTransactions();

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="问一问：上周花了多少钱？" placeholderTextColor="#64748b" />
      <DailySummary transactions={data?.data ?? []} />
      <TransactionList transactions={data?.data ?? []} isLoading={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  search: { margin: 16, padding: 12, backgroundColor: "#1e293b", borderRadius: 20, color: "#fff", fontSize: 14 },
});
```

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/hooks/useTransactions.ts apps/mobile/components/home/ apps/mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): add home screen with daily summary and transaction list"
```

---

## Chunk 5: AI 聊天页（核心）

### Task 17: Chat Store + Hook

**Files:**
- Create: `apps/mobile/store/chatStore.ts`
- Create: `apps/mobile/hooks/useChat.ts`

- [ ] **Step 1: 创建 chatStore（Zustand）**

```typescript
// apps/mobile/store/chatStore.ts
import { create } from "zustand";
import type { ChatMessage } from "@coco/shared";

interface ChatState {
  readonly messages: readonly ChatMessage[];
  readonly isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: readonly ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

- [ ] **Step 2: 创建 useChat hook**

```typescript
// apps/mobile/hooks/useChat.ts
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useChatStore } from "../store/chatStore";

export function useChat() {
  const { addMessage, setLoading } = useChatStore();
  const qc = useQueryClient();

  const sendText = useCallback(async (text: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "text", content: text, transaction_id: null, created_at: new Date().toISOString() });
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/text", { method: "POST", body: JSON.stringify({ text }) });
      if (resp.data?.type === "bill") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify(resp.data.transaction), transaction_id: resp.data.transaction.id, created_at: new Date().toISOString() });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else if (resp.data?.type === "nl_result") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "nl_result", content: resp.data.message, transaction_id: null, created_at: new Date().toISOString() });
      } else {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: resp.data?.message ?? "处理完成", transaction_id: null, created_at: new Date().toISOString() });
      }
    } catch {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "网络错误，请重试。", transaction_id: null, created_at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, qc]);

  const sendOcr = useCallback(async (imageBase64: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "image", content: "[拍照]", transaction_id: null, created_at: new Date().toISOString() });
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/ocr", { method: "POST", body: JSON.stringify({ imageBase64 }) });
      if (resp.data?.type === "bill") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify(resp.data.transaction), transaction_id: resp.data.transaction.id, created_at: new Date().toISOString() });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: resp.data?.message ?? "小票识别失败，请手动记账。", transaction_id: null, created_at: new Date().toISOString() });
      }
    } catch {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "网络错误，OCR 识别失败。", transaction_id: null, created_at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, qc]);

  const sendAsr = useCallback(async (audioBase64: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "audio", content: "[语音]", transaction_id: null, created_at: new Date().toISOString() });
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/asr", { method: "POST", body: JSON.stringify({ audioBase64 }) });
      if (resp.data?.type === "bill") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify(resp.data.transaction), transaction_id: resp.data.transaction.id, created_at: new Date().toISOString() });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: resp.data?.message ?? "没听清，要不再说一次？", transaction_id: null, created_at: new Date().toISOString() });
      }
    } catch {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "网络错误，语音识别失败。", transaction_id: null, created_at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, qc]);

  return { sendText, sendOcr, sendAsr };
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/store/ apps/mobile/hooks/useChat.ts
git commit -m "feat(mobile): add chat store and useChat hook with text/ocr/asr support"
```

### Task 18: Chat UI 组件

**Files:**
- Create: `apps/mobile/components/chat/ChatMessage.tsx`
- Create: `apps/mobile/components/chat/BillCard.tsx`
- Create: `apps/mobile/components/chat/ChatInput.tsx`
- Create: `apps/mobile/components/chat/VoiceRecorder.tsx`

- [ ] **Step 1: 创建 BillCard 组件**

```typescript
// apps/mobile/components/chat/BillCard.tsx
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import type { Transaction } from "@coco/shared";
import { useDeleteTransaction } from "../../hooks/useTransactions";

interface Props {
  readonly transaction: Transaction;
  readonly onEdit?: (tx: Transaction) => void;
}

export function BillCard({ transaction: tx, onEdit }: Props) {
  const deleteMutation = useDeleteTransaction();
  const isExpense = tx.type === "expense";
  const lowConfidence = (tx.ai_confidence ?? 1) < 0.7;

  const handleDelete = () => {
    Alert.alert("删除记录", "确定要删除这条记录吗？", [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(tx.id) },
    ]);
  };

  return (
    <View style={[styles.card, { borderLeftColor: isExpense ? "#ef4444" : "#22c55e" }]}>
      {lowConfidence && <Text style={styles.warning}>⚠️ 置信度较低，请确认</Text>}
      <View style={styles.main}>
        <View style={styles.left}>
          <Text style={styles.icon}>{tx.categories?.icon ?? "📦"}</Text>
          <View>
            <Text style={styles.category}>{tx.categories?.name ?? "未分类"}</Text>
            {tx.note ? <Text style={styles.note}>{tx.note}</Text> : null}
          </View>
        </View>
        <Text style={[styles.amount, { color: isExpense ? "#ef4444" : "#22c55e" }]}>
          {isExpense ? "-" : "+"}¥{tx.amount.toFixed(2)}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.date}>{tx.occurred_at.slice(0, 10)}</Text>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(tx)}>
              <Text style={styles.action}>✏️ 编辑</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.action}>🗑️ 删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderLeftWidth: 3, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  warning: { color: "#d97706", fontSize: 10, marginBottom: 6, fontWeight: "600" },
  main: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  left: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { fontSize: 24 },
  category: { fontWeight: "600", fontSize: 14, color: "#0f172a" },
  note: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  amount: { fontWeight: "700", fontSize: 18 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  date: { color: "#94a3b8", fontSize: 10 },
  actions: { flexDirection: "row", gap: 12 },
  action: { color: "#94a3b8", fontSize: 10 },
});
```

- [ ] **Step 2: 创建 ChatMessage 组件**

```typescript
// apps/mobile/components/chat/ChatMessage.tsx
import { View, Text, StyleSheet } from "react-native";
import type { ChatMessage as ChatMessageType } from "@coco/shared";
import { BillCard } from "./BillCard";

interface Props {
  readonly message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  const renderContent = () => {
    switch (message.content_type) {
      case "bill_card": {
        const tx = JSON.parse(message.content);
        return <BillCard transaction={tx} />;
      }
      case "audio":
        return (
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={isUser ? styles.userText : styles.aiText}>🎙️ 语音消息</Text>
          </View>
        );
      case "image":
        return (
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={isUser ? styles.userText : styles.aiText}>🧾 图片</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={isUser ? styles.userText : styles.aiText}>{message.content}</Text>
          </View>
        );
    }
  };

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>✦</Text>
        </View>
      )}
      <View style={styles.contentWrapper}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 10, alignItems: "flex-start" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f59e0b", justifyContent: "center", alignItems: "center", marginRight: 8 },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  contentWrapper: { maxWidth: "80%" },
  bubble: { borderRadius: 12, padding: 10 },
  userBubble: { backgroundColor: "#6366f1", borderTopRightRadius: 0 },
  aiBubble: { backgroundColor: "#fff", borderTopLeftRadius: 0, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  userText: { color: "#fff", fontSize: 14 },
  aiText: { color: "#0f172a", fontSize: 14 },
});
```

- [ ] **Step 3: 创建 ChatInput 组件**

```typescript
// apps/mobile/components/chat/ChatInput.tsx
import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { VoiceRecorder } from "./VoiceRecorder";

interface Props {
  readonly onSendText: (text: string) => void;
  readonly onSendImage: (base64: string) => void;
  readonly onSendAudio: (base64: string) => void;
  readonly isLoading: boolean;
  readonly onManualEntry?: () => void;
}

export function ChatInput({ onSendText, onSendImage, onSendAudio, isLoading, onManualEntry }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].base64) {
      onSendImage(result.assets[0].base64);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.chips}>
        <TouchableOpacity style={styles.chip} onPress={onManualEntry}>
          <Text style={styles.chipText}>✏️ 手动记账</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip}>
          <Text style={styles.chipText}>💬 问一问</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleCamera}>
          <Text style={{ fontSize: 20 }}>📷</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="发消息或按住说话..."
          placeholderTextColor="#94a3b8"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!isLoading}
        />
        {text.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isLoading}>
            <Text style={styles.sendText}>↑</Text>
          </TouchableOpacity>
        ) : (
          <VoiceRecorder onRecorded={onSendAudio} disabled={isLoading} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderTopWidth: 1, borderTopColor: "#334155", paddingTop: 8, paddingHorizontal: 12, paddingBottom: 20, backgroundColor: "#0f172a" },
  chips: { flexDirection: "row", gap: 6, marginBottom: 8 },
  chip: { backgroundColor: "#1e293b", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipText: { color: "#818cf8", fontSize: 11 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1e293b", justifyContent: "center", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#1e293b", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" },
  sendText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
```

- [ ] **Step 4: 创建 VoiceRecorder 组件**

```typescript
// apps/mobile/components/chat/VoiceRecorder.tsx
import { useState, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, Animated } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

interface Props {
  readonly onRecorded: (base64: string) => void;
  readonly disabled: boolean;
}

export function VoiceRecorder({ onRecorded, disabled }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: { extension: ".wav", sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT },
        ios: { extension: ".wav", sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, outputFormat: Audio.IOSOutputFormat.LINEARPCM, audioQuality: Audio.IOSAudioQuality.HIGH, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: {},
      });
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (err) {
      console.error("Recording failed:", err);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) clearInterval(timerRef.current);
    scale.stopAnimation();
    scale.setValue(1);
    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        onRecorded(base64);
      }
    } catch (err) {
      console.error("Stop recording failed:", err);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, isRecording && styles.btnRecording]}
      onPressIn={startRecording}
      onPressOut={stopRecording}
      disabled={disabled}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={styles.icon}>{isRecording ? `${duration}"` : "🎙️"}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" },
  btnRecording: { backgroundColor: "#ef4444" },
  icon: { color: "#fff", fontSize: 16 },
});
```

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/components/chat/
git commit -m "feat(mobile): add chat UI components (message, bill card, input, voice recorder)"
```

### Task 19: AI 聊天页面

**Files:**
- Create: `apps/mobile/app/chat.tsx`
- Create: `apps/mobile/components/ManualEntryForm.tsx`

- [ ] **Step 1: 实现聊天页面**

```typescript
// apps/mobile/app/chat.tsx
import { useState } from "react";
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatInput } from "../components/chat/ChatInput";
import { ManualEntryForm } from "../components/ManualEntryForm";

export default function ChatScreen() {
  const { messages, isLoading } = useChatStore();
  const { sendText, sendOcr, sendAsr } = useChat();
  const [showManual, setShowManual] = useState(false);
  const { addMessage } = useChatStore();

  const handleManualSuccess = (tx: any) => {
    addMessage({
      id: Date.now().toString(), user_id: "", role: "assistant",
      content_type: "bill_card", content: JSON.stringify(tx),
      transaction_id: tx.id, created_at: new Date().toISOString(),
    });
  };

  return (
    <View style={styles.container}>
      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>✦ CoCo AI</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 聊天消息列表 */}
      <FlatList
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={styles.list}
      />

      {/* 输入区 */}
      <ChatInput
        onSendText={sendText}
        onSendImage={sendOcr}
        onSendAudio={sendAsr}
        isLoading={isLoading}
        onManualEntry={() => setShowManual(true)}
      />

      {/* 手动记账表单 */}
      <ManualEntryForm
        visible={showManual}
        onClose={() => setShowManual(false)}
        onSuccess={handleManualSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: "#1e1b4b" },
  back: { color: "#fff", fontSize: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  list: { padding: 12 },
});
```

- [ ] **Step 2: 创建手动记账表单（Modal）**

```typescript
// apps/mobile/components/ManualEntryForm.tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert } from "react-native";
import { apiFetch } from "../lib/api";
import { CategoryPicker } from "./CategoryPicker";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (tx: any) => void;
}

export function ManualEntryForm({ visible, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("请输入有效金额");
      return;
    }
    if (!categoryId) {
      Alert.alert("请选择分类");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await apiFetch<any>("/api/record/manual", {
        method: "POST",
        body: JSON.stringify({ amount: numAmount, category_id: categoryId, note, type, occurred_at: date.toISOString() }),
      });
      if (resp.success) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        onSuccess?.(resp.data);
        onClose();
        setAmount("");
        setNote("");
        setCategoryId(null);
      }
    } catch {
      Alert.alert("提交失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancel}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.title}>手动记账</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              <Text style={[styles.save, submitting && { opacity: 0.5 }]}>保存</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body}>
            {/* 收支切换 */}
            <View style={styles.typeRow}>
              <TouchableOpacity style={[styles.typeBtn, type === "expense" && styles.typeBtnActive]} onPress={() => setType("expense")}>
                <Text style={[styles.typeText, type === "expense" && styles.typeTextActive]}>支出</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, type === "income" && styles.typeBtnIncome]} onPress={() => setType("income")}>
                <Text style={[styles.typeText, type === "income" && styles.typeTextActive]}>收入</Text>
              </TouchableOpacity>
            </View>
            {/* 金额 */}
            <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#64748b" keyboardType="decimal-pad" />
            {/* 分类选择 */}
            <CategoryPicker selectedId={categoryId} onSelect={setCategoryId} type={type} />
            {/* 日期选择（简易：显示当前日期，点击切换到昨天/前天/今天） */}
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>选择日期</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, -1, -2].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const label = offset === 0 ? "今天" : offset === -1 ? "昨天" : "前天";
                  const isSelected = date.toDateString() === d.toDateString();
                  return (
                    <TouchableOpacity key={offset} style={[styles.typeBtn, isSelected && styles.typeBtnActive]} onPress={() => setDate(d)}>
                      <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {/* 备注 */}
            <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="添加备注..." placeholderTextColor="#64748b" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0f172a", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  cancel: { color: "#94a3b8", fontSize: 16 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  save: { color: "#6366f1", fontSize: 16, fontWeight: "600" },
  body: { padding: 16 },
  typeRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#ef4444" },
  typeBtnIncome: { backgroundColor: "#22c55e" },
  typeText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  amountInput: { fontSize: 36, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 20, padding: 16, backgroundColor: "#1e293b", borderRadius: 12 },
  noteInput: { backgroundColor: "#1e293b", color: "#fff", padding: 14, borderRadius: 12, fontSize: 14, marginTop: 16 },
});
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/chat.tsx apps/mobile/components/ManualEntryForm.tsx
git commit -m "feat(mobile): add AI chat screen with manual entry form"
```

---

## Chunk 6: 统计 + 预算 + 我的 + 收尾

### Task 20: 统计页

**Files:**
- Create: `apps/mobile/app/(tabs)/stats.tsx`

> 注：MVP 阶段统计页使用纯 RN 组件（进度条）渲染分类排行，后续可引入 react-native-chart-kit 拆出 PieChart/TrendChart。

- [ ] **Step 1: 实现统计页**

```typescript
// apps/mobile/app/(tabs)/stats.tsx
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

type Period = "week" | "month" | "year";

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (period === "week") start.setDate(now.getDate() - 7);
  else if (period === "month") start.setMonth(now.getMonth() - 1);
  else start.setFullYear(now.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end };
}

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>("month");
  const range = getDateRange(period);

  const { data, isLoading } = useQuery({
    queryKey: ["stats", period],
    queryFn: () => apiFetch<any>(`/api/stats?start_date=${range.start}&end_date=${range.end}`),
  });

  const stats = data?.data;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>统计</Text>

      {/* 周期选择器 */}
      <View style={styles.periodRow}>
        {(["week", "month", "year"] as const).map((p) => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {{ week: "周", month: "月", year: "年" }[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#818cf8" />
      ) : stats ? (
        <>
          {/* 收支概览卡片 */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总收入</Text>
              <Text style={[styles.summaryAmount, { color: "#22c55e" }]}>+¥{(stats.totalIncome ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总支出</Text>
              <Text style={[styles.summaryAmount, { color: "#ef4444" }]}>-¥{(stats.totalExpense ?? 0).toFixed(2)}</Text>
            </View>
          </View>

          {/* 分类支出排行 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>分类支出排行</Text>
            {(stats.categoryBreakdown ?? []).map((cat: any, i: number) => (
              <View key={cat.name ?? i} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <Text style={styles.categoryIcon}>{cat.icon ?? "📦"}</Text>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${(cat.percentage ?? 0)}%` }]} />
                  </View>
                  <Text style={styles.categoryAmount}>¥{(cat.amount ?? 0).toFixed(0)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>暂无数据</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 50 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  periodRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: "#1e293b", alignItems: "center" },
  periodBtnActive: { backgroundColor: "#6366f1" },
  periodText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  periodTextActive: { color: "#fff" },
  summaryCard: { marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 16, padding: 20, flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  summaryItem: { alignItems: "center" },
  summaryLabel: { color: "#64748b", fontSize: 12, marginBottom: 6 },
  summaryAmount: { fontSize: 20, fontWeight: "700" },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 8, width: 80 },
  categoryIcon: { fontSize: 18 },
  categoryName: { color: "#cbd5e1", fontSize: 13 },
  categoryRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  barBg: { flex: 1, height: 8, backgroundColor: "#334155", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: "#6366f1", borderRadius: 4 },
  categoryAmount: { color: "#94a3b8", fontSize: 12, width: 60, textAlign: "right" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/app/\(tabs\)/stats.tsx
git commit -m "feat(mobile): add stats screen with category breakdown"
```

### Task 21: 预算页

**Files:**
- Create: `apps/mobile/app/(tabs)/budget.tsx`
- Create: `apps/mobile/components/budget/BudgetCard.tsx`
- Create: `apps/mobile/components/budget/BudgetForm.tsx`
- Create: `apps/mobile/hooks/useBudgets.ts`

- [ ] **Step 1: 创建 useBudgets hook**

```typescript
// apps/mobile/hooks/useBudgets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export function useBudgets() {
  return useQuery({ queryKey: ["budgets"], queryFn: () => apiFetch<any>("/api/budgets") });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiFetch<any>("/api/budgets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}
```

- [ ] **Step 2: 实现预算页**

```typescript
// apps/mobile/app/(tabs)/budget.tsx
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useBudgets } from "../../hooks/useBudgets";

export default function BudgetScreen() {
  const { data, isLoading } = useBudgets();
  const budgets = data?.data ?? [];

  const totalBudget = budgets.reduce((s: number, b: any) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s: number, b: any) => s + (b.spent ?? 0), 0);
  const totalPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>预算</Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#818cf8" />
      ) : (
        <>
          {/* 总预算概览 */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>本月总预算</Text>
            <Text style={styles.totalAmount}>¥{totalSpent.toFixed(0)} / ¥{totalBudget.toFixed(0)}</Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${totalPercent}%`, backgroundColor: totalPercent > 90 ? "#ef4444" : "#6366f1" }]} />
            </View>
            <Text style={styles.totalPercent}>{totalPercent.toFixed(0)}%</Text>
          </View>

          {/* 分类预算卡片列表 */}
          {budgets.map((budget: any) => {
            const spent = budget.spent ?? 0;
            const percent = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
            const overBudget = spent > budget.amount;

            return (
              <View key={budget.id} style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetLeft}>
                    <Text style={styles.budgetIcon}>{budget.categories?.icon ?? "📦"}</Text>
                    <Text style={styles.budgetName}>{budget.categories?.name ?? "未分类"}</Text>
                  </View>
                  <Text style={[styles.budgetAmount, overBudget && { color: "#ef4444" }]}>
                    ¥{spent.toFixed(0)} / ¥{budget.amount.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: overBudget ? "#ef4444" : "#22c55e" }]} />
                </View>
              </View>
            );
          })}

          {/* 添加预算按钮 */}
          <TouchableOpacity style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ 添加预算</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 50 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  totalCard: { margin: 16, backgroundColor: "#1e293b", borderRadius: 16, padding: 20 },
  totalLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  totalAmount: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 12 },
  totalPercent: { color: "#94a3b8", fontSize: 12, textAlign: "right", marginTop: 4 },
  progressBg: { height: 8, backgroundColor: "#334155", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  budgetCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e293b", borderRadius: 12, padding: 14 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  budgetLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetIcon: { fontSize: 20 },
  budgetName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  budgetAmount: { color: "#cbd5e1", fontSize: 13 },
  addBtn: { margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#334155", borderStyle: "dashed", alignItems: "center" },
  addBtnText: { color: "#818cf8", fontSize: 14, fontWeight: "600" },
});
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/\(tabs\)/budget.tsx apps/mobile/components/budget/ apps/mobile/hooks/useBudgets.ts
git commit -m "feat(mobile): add budget screen with budget cards and form"
```

### Task 22: 我的页面

**Files:**
- Create: `apps/mobile/app/(tabs)/profile.tsx`
- Create: `apps/mobile/hooks/useCategories.ts`
- Create: `apps/mobile/components/CategoryPicker.tsx`

- [ ] **Step 1: 创建 useCategories hook**

```typescript
// apps/mobile/hooks/useCategories.ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { ApiResponse, Category } from "@coco/shared";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<ApiResponse<Category[]>>("/api/categories"),
  });
}
```

- [ ] **Step 2: 创建 CategoryPicker 组件**

```typescript
// apps/mobile/components/CategoryPicker.tsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useCategories } from "../hooks/useCategories";

interface Props {
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly type: "expense" | "income";
}

export function CategoryPicker({ selectedId, onSelect, type }: Props) {
  const { data } = useCategories();
  const categories = (data?.data ?? []).filter((c: any) => c.type === type);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>选择分类</Text>
      <ScrollView horizontal={false} contentContainerStyle={styles.grid}>
        {categories.map((cat: any) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.item, selectedId === cat.id && styles.itemActive]}
            onPress={() => onSelect(cat.id)}
          >
            <Text style={styles.icon}>{cat.icon}</Text>
            <Text style={[styles.name, selectedId === cat.id && styles.nameActive]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  label: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: { width: "22%", alignItems: "center", padding: 10, borderRadius: 12, backgroundColor: "#1e293b" },
  itemActive: { backgroundColor: "#6366f1" },
  icon: { fontSize: 24, marginBottom: 4 },
  name: { color: "#94a3b8", fontSize: 10 },
  nameActive: { color: "#fff" },
});
```

- [ ] **Step 3: 实现我的页面**

```typescript
// apps/mobile/app/(tabs)/profile.tsx
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
      const endDate = now.toISOString().slice(0, 10);
      const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

      const resp = await fetch(`${API_BASE}/api/export?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.ok) {
        const csv = await resp.text();
        Alert.alert("导出成功", `已导出 ${csv.split("\\n").length - 1} 条记录`);
        // TODO: 后续可用 expo-sharing 分享 CSV 文件
      } else {
        Alert.alert("导出失败", "请重试");
      }
    } catch {
      Alert.alert("导出失败", "网络错误");
    }
  };

  const handleSignOut = () => {
    Alert.alert("退出登录", "确定要退出吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>我的</Text>

      {/* 账号信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>账号信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>邮箱</Text>
          <Text style={styles.infoValue}>{session?.user?.email ?? "-"}</Text>
        </View>
      </View>

      {/* 功能列表 */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>📂</Text>
          <Text style={styles.menuText}>分类管理</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleExport}>
          <Text style={styles.menuIcon}>📥</Text>
          <Text style={styles.menuText}>导出数据 (CSV)</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 退出登录 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 50 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  section: { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#1e293b", borderRadius: 12, overflow: "hidden" },
  sectionTitle: { color: "#94a3b8", fontSize: 12, padding: 14, paddingBottom: 0 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  infoLabel: { color: "#94a3b8", fontSize: 14 },
  infoValue: { color: "#fff", fontSize: 14 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#334155" },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuText: { color: "#fff", fontSize: 14, flex: 1 },
  menuArrow: { color: "#64748b", fontSize: 18 },
  logoutBtn: { margin: 16, padding: 14, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/hooks/useCategories.ts apps/mobile/components/CategoryPicker.tsx
git commit -m "feat(mobile): add profile screen with category picker and data export"
```

### Task 23: 最终集成验证

- [ ] **Step 1: 安装所有依赖**

```bash
cd /path/to/coco && pnpm install
```

- [ ] **Step 2: 运行 AI 包测试**

```bash
cd packages/ai && pnpm test
```
Expected: 全部 PASS

- [ ] **Step 3: 验证 BFF 构建**

```bash
cd apps/api && pnpm build
```
Expected: 构建成功

- [ ] **Step 4: 验证移动端启动**

```bash
cd apps/mobile && npx expo start
```
Expected: Metro bundler 启动成功

- [ ] **Step 5: 提交最终状态**

```bash
git add turbo.json pnpm-workspace.yaml package.json pnpm-lock.yaml
git commit -m "chore: final integration verification and lockfile update"
```
