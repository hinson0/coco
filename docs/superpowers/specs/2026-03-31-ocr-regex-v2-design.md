# OCR 正则提取增强 v2 设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 扩展 `extractReceiptInfo()` 的正则模式，覆盖餐厅和医院小票，并将金额匹配策略从「取第一次」改为「取最后一次」，避免误命中子合计。

**Architecture:** 仅修改 `supabase/functions/record-ocr/index.ts` 中的 `extractReceiptInfo()` 函数：新增 3 条金额 pattern、改用 `matchAll` 取最后一次匹配、补充 `YYYY-MM-DD` 日期格式。

**Tech Stack:** Deno Edge Function（正则）

---

## 背景

### 已知失败场景

| 小票类型 | OCR 关键字 | 当前结果 |
|---------|-----------|---------|
| 餐厅预打单（南昌餐馆三店） | `消费:117.00` / `应收:117.00` | ❌ ocr_text（无匹配） |
| 医院缴费单（抚州市立医院） | `个人账户支付:25.74` | ❌ ocr_text（无匹配） |
| 超市多商品小票 | `合计` 出现多次（子合计 + 总计） | ⚠️ 可能命中子合计而非总额 |

### 为什么「取最后一次」

收据结构普遍规律：明细在前，汇总在后。`合计`、`小计`、`总计` 等关键字可能在明细区域出现多次（分类小计），最后一次出现的才是总付金额。

---

## 改动设计

### 1. 金额模式：8 条，优先级从高到低

```typescript
const amountPatterns = [
  /应.{0,2}金额[：:]\s*([\d]+\.[\d]{2})/,          // 超市：应付金额（兼容 OCR 错字）
  /实.{0,2}付[：:]\s*([\d]+\.[\d]{2})/,              // 超市：实付/实际付款
  /个人账.{0,2}支付[：:]\s*([\d]+\.[\d]{2})/,        // 医院：个人账户支付（扣医保后自付）
  /合计[：:]?\s*\d+[件个张]?\s*\n?([\d]+\.[\d]{2})/, // 超市：合计 N 件 + 金额
  /总计[：:]\s*([\d]+\.[\d]{2})/,                    // 通用
  /消费[：:]\s*([\d]+\.[\d]{2})/,                    // 餐厅预打单
  /应收[：:]\s*([\d]+\.[\d]{2})/,                    // 餐厅预打单
  /小计[：:]\s*([\d]+\.[\d]{2})/,                    // 单品小票
];
```

### 2. 匹配策略：取最后一次

**改动前：**
```typescript
const match = ocrText.match(pattern);
if (match) { ... }
```

**改动后：**
```typescript
const matches = [...ocrText.matchAll(new RegExp(pattern.source, "g"))];
const match = matches.at(-1) ?? null;
if (match) { ... }
```

外层逻辑不变：依次尝试每条 pattern，第一个命中且 `val > 0` 的为最终结果。

### 3. 日期正则补充 YYYY-MM-DD

**改动前：**
```typescript
const dateMatch = ocrText.match(/(\d{4})[.年](\d{1,2})[.月](\d{1,2})/);
const date = dateMatch
  ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}T00:00:00Z`
  : null;
```

**改动后：**
```typescript
const isoMatch = ocrText.match(/(\d{4})-(\d{2})-(\d{2})/);
const dotMatch = ocrText.match(/(\d{4})[.年](\d{1,2})[.月](\d{1,2})/);
const dateMatch = isoMatch ?? dotMatch;
const date = dateMatch
  ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}T00:00:00Z`
  : null;
```

覆盖格式：
- `2025-12-26 08:14:33`（医院缴费单）
- `2026.3.24`（超市小票）
- `2026年3月24日`（通用）

---

## 覆盖范围与已知限制

### 覆盖

| 场景 | 关键字 | 预期结果 |
|------|-------|---------|
| 超市多商品（多个合计行） | `合计`（取最后一次） | ✅ bill（总金额） |
| 餐厅预打单 | `消费:` / `应收:` | ✅ bill |
| 医院缴费单 | `个人账户支付:` | ✅ bill（自付金额） |
| 医院免费就诊（个人账户支付: 0.00） | `个人账户支付: 0.00` → val=0 跳过 | → ocr_text，用户手动 |

### 已知限制（不在本次范围）

- **医院挂号凭条**：无统一总金额关键字（金额分散在现金支付/账户支付多行），回落 ocr_text
- **多人就餐 AA 制**：无法识别，回落 ocr_text
- **外币小票**：不支持

---

## 不改动

- 商户名提取逻辑（取第一行有意义文字）
- `bill` 响应的 `category` 字段（仍为 `"购物"`，分类推断是独立功能）
- `record-asr`、`useChat.ts`、客户端组件
