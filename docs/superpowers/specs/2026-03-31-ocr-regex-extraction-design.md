# OCR 正则提取优化设计（去除 GLM）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 OCR 小票识别从「腾讯 OCR + GLM（~92s）」优化为「腾讯 OCR + 服务端正则提取（~3s）」，彻底消除 GLM 带来的等待。

**Architecture:** 服务端 `record-ocr` 用正则从 OCR 文字中提取总金额/商户名/日期，成功则返回单条账单；失败则返回原始 OCR 文字 + 商户名，客户端自动跳转手动记账并预填商户名。

**Tech Stack:** Deno Edge Function（正则）、React Native（useChat + expo-router）

---

## 背景数据

- 腾讯 OCR 耗时：~2.7s ✅
- GLM 耗时：~91.6s ❌（本次小票有 15 件商品，文字量大）
- 当前 bug：GLM 返回 15 条数组，代码只检查 `parsed.amount`（单对象），导致即使 GLM 成功也显示「识别失败」

---

## 服务端设计（record-ocr）

### 删除 GLM，新增 `extractReceiptInfo()`

```typescript
interface ReceiptInfo {
  amount: number | null;
  merchant: string | null;
  date: string | null;
}

function extractReceiptInfo(ocrText: string): ReceiptInfo {
  // ── 总金额：多模式依次尝试 ──
  const amountPatterns = [
    /应.{0,2}金额[：:]\s*([\d]+\.[\d]{2})/,   // 应付金额（兼容 OCR 错字）
    /实.{0,2}付[：:]\s*([\d]+\.[\d]{2})/,       // 实付/实际付款
    /合计[：:]?\s*\d+[件个张]?\s*\n?([\d]+\.[\d]{2})/, // 合计 N 件 + 金额
    /总计[：:]\s*([\d]+\.[\d]{2})/,             // 总计
    /小计[：:]\s*([\d]+\.[\d]{2})/,             // 小计（单商品小票）
  ];

  let amount: number | null = null;
  for (const pattern of amountPatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0) { amount = val; break; }
    }
  }

  // ── 商户名：取第一行有意义的文字（排除纯数字/条码行）──
  const lines = ocrText.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1 && !/^[\d\s\-:.]+$/.test(l));
  const merchant = lines[0] ?? null;

  // ── 日期：YYYY.M.D 或 YYYY年M月D日 ──
  const dateMatch = ocrText.match(/(\d{4})[.年](\d{1,2})[.月](\d{1,2})/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}T00:00:00`
    : null;

  return { amount, merchant, date };
}
```

### 响应格式

**成功（找到金额）：**
```json
{
  "data": {
    "type": "bill",
    "transaction": {
      "amount": 163.92,
      "category": "购物",
      "note": "凯升购物广场",
      "type": "expense",
      "occurred_at": "2026-03-24T00:00:00"
    }
  }
}
```

**失败（找不到金额）：**
```json
{
  "data": {
    "type": "ocr_text",
    "ocrText": "彩超市儿店\n...",
    "merchant": "凯升购物广场"
  }
}
```

OCR 文字为空时（图片不清晰）保持原有响应：
```json
{ "data": { "type": "text", "message": "无法识别小票内容，请确保图片清晰后重试。" } }
```

---

## 客户端设计

### `useChat.ts`（sendOcr）

在 `sendOcr` 的响应处理中新增 `ocr_text` 分支：

```typescript
} else if (resp.data?.type === "ocr_text") {
  // 识别到文字但提取不到金额 → 跳转手动记账，预填商户名
  const merchant = resp.data.merchant ?? "";
  router.push({
    pathname: "/manual-entry",
    params: { ocrNote: merchant },
  });
  // 发一条提示消息
  await addMessage({
    role: "assistant",
    content_type: "text",
    content: merchant
      ? `已识别商户「${merchant}」，请手动补充金额完成记账。`
      : "已识别小票内容，请手动补充金额完成记账。",
  });
}
```

### `manual-entry.tsx`

支持 `ocrNote` 路由参数，自动预填 note 字段（已有 `txData` 预填模式，同样方式处理）：

```typescript
const params = useLocalSearchParams<{ txData?: string; msgId?: string; ocrNote?: string }>();

// note 初始值：ocrNote 优先，其次 txData 中的 note
const [note, setNote] = useState(
  () => params.ocrNote ?? (parsedTx?.note ?? "")
);
```

---

## 数据流总览

```
用户拍照
  │
  ▼
sendOcr（保存图片到本地，显示图片气泡）
  │
  ▼
POST /record-ocr（imageBase64）
  │
  ├─ 腾讯 OCR → 原始文字（~3s）
  │
  ├─ extractReceiptInfo() → {amount, merchant, date}
  │
  ├─ amount 存在 ──────────────────────► bill 响应
  │                                        │
  │                                        ▼
  │                                   createTransaction
  │                                   addMessage(bill_card)
  │
  └─ amount 为 null ───────────────────► ocr_text 响应
                                          │
                                          ▼
                                     addMessage(提示文字)
                                     router.push(/manual-entry?ocrNote=...)
```

---

## 不在范围内

- ASR 的 GLM 去除（独立任务，不在本 spec 内）
- SSE 流式输出（3s 内不需要，未来有需要再做）
- 多语言小票支持（超出当前需求）
