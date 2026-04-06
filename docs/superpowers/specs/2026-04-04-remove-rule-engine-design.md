# 移除规则引擎，统一 Silicon LLM 记账

## 背景

当前记账流程采用三层降级：规则引擎 `parse()` → LLM → 手动。规则引擎基于正则和关键词匹配，维护成本高且覆盖有限。OCR 也用独立的正则提取金额/商户。

本次改造去掉规则引擎和 OCR 正则提取，所有"理解"统一交给 Silicon LLM。

## 新流程

### 文字/语音 → `/chat`

```
文字输入 ──┐
            ├─→ /chat ─→ classify_intent ─→ record → Silicon extract_bill → 账单
语音输入 ──┘                               ├→ query  → generate_sql → 查询结果
  (先 ASR 转文字)                          └→ chat   → chat_reply → 闲聊回复
```

`/chat` 请求体：
- 文字：`{ "text": "买了杯咖啡30块" }`
- 语音：`{ "audioBase64": "..." }`

后端根据字段判断输入类型，语音先走腾讯云 ASR 转文字，再进 `classify_intent` 统一流程。

语音场景响应额外携带 `asrText` 字段，供前端展示语音转文字内容。

### 拍照 → `/record-ocr`

```
图片 → 腾讯云 OCR → raw_text → Silicon extract_bill_from_receipt → 账单
```

OCR 只负责图片转文字，Silicon 用 OCR 专用 prompt 提取总金额、分类、消费明细。

## 删除清单

### 规则引擎（整个删除）
- `packages/shared/src/rule-engine/` 全部文件
  - `index.ts` — `parse()` 入口
  - `extract-amount.ts` — 金额提取
  - `strip-amount.ts` — 金额去除
  - `match-category.ts` — 分类匹配
  - `keywords.ts` — 关键词库
  - `index.test.ts`, `match-category.test.ts` — 测试
- `packages/shared` 导出中移除 `parse` 相关

### GLM 旧实现
- `apps/backend/services/glm.py`
- `apps/backend/routers/text.py`（`/record-text` 路由）

### ASR 独立端点（合并进 `/chat`）
- `apps/backend/routers/asr.py`
- `apps/backend/schemas/asr.py`

### OCR 正则提取
- `apps/backend/routers/ocr.py` 中的 `extract_receipt_info()` 函数
- `apps/backend/schemas/ocr.py` 中的 `OcrTextData`（不再需要多种返回类型）

## 后端改动

### `silicon.py` — 新增 OCR 专用函数

新增 `extract_bill_from_receipt(raw_text: str) -> dict | None`

OCR 专用 system prompt 要求 Silicon：
- 输入是小票 OCR 文本
- 提取总金额、分类、逐行消费明细、收支类型、时间
- 返回格式：

```json
{
  "amount": 99.50,
  "category": "餐饮",
  "note": "拿铁 28.00\n美式 22.00\n蛋糕 49.50",
  "type": "expense",
  "occurred_at": "2026-04-04T10:00:00"
}
```

`note` 为逐行明细，格式 `商品名 金额\n商品名 金额`。

### `/chat` 路由 — 支持语音输入

- 请求体新增可选 `audioBase64` 字段
- 若有 `audioBase64`：调用腾讯云 ASR 转文字，再走 `classify_intent` → record/query/chat
- 若有 `text`：直接走 `classify_intent`（与现有逻辑一致，只是去掉规则引擎前置）
- 响应中语音场景多返回 `asrText` 字段

### `/record-ocr` 路由 — 去掉正则，接入 Silicon

- 图片 → 腾讯云 OCR → `raw_text`
- `raw_text` → `extract_bill_from_receipt(raw_text)` → 结构化账单
- 响应简化为 bill / error 两种类型

### 清理路由注册

- `main.py` 中移除 `text` 和 `asr` 路由的注册
- 移除 `glm` 相关 import

## 前端改动

### `useChat.ts`

**`sendText()`：**
- 删除 `parse()` 规则引擎调用
- 文字直接 `POST /chat { text }` 处理

**`sendAsr()`：**
- 不再调 `/record-asr` + `processText()`
- 改为 `POST /chat { audioBase64 }`
- 后端返回结构化结果（bill/nl_result/text + asrText）
- 语音气泡用 `asrText` 展示转写文字

**`sendOcr()`：**
- 简化为只处理 bill / error 两种响应
- 去掉 `type="ocr_text"` 时的补充金额逻辑

**依赖清理：**
- 移除 `import { parse } from "@coco/shared"`

## 接口格式

### `/chat` 请求

```typescript
// 文字
{ text: string }

// 语音
{ audioBase64: string }
```

### `/chat` 响应

```typescript
// 记账
{ data: { type: "bill", asrText?: string, transaction: { amount, category, note, type, occurred_at } } }

// 查询
{ data: { type: "nl_result", asrText?: string, message: string } }

// 闲聊
{ data: { type: "text", asrText?: string, message: string } }
```

### `/record-ocr` 响应

```typescript
// 成功
{ data: { type: "bill", transaction: { amount, category, note, type, occurred_at } } }

// 失败
{ data: { type: "error", message: string } }
```
