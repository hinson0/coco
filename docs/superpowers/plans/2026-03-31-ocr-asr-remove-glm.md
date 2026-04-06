# OCR + ASR 全面去除 GLM 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去除 OCR 和 ASR 两条路径中的全部 GLM 调用，将小票识别从 ~92s 降至 ~3s，语音/文字输入规则引擎未命中时直接提示手动记账。

**Architecture:** 服务端 `record-ocr` 改为正则提取总金额；客户端 `processText` 删除 GLM 兜底；`sendOcr` 新增 `onOcrText` 回调处理「识别到文字但无金额」情况；`manual-entry` 支持 `ocrNote` 参数预填备注。

**Tech Stack:** Deno Edge Function（正则）、React Native（expo-router、useChat hook）

---

## 涉及文件

- **修改** `supabase/functions/record-ocr/index.ts` — 删除 GLM，改用正则提取
- **修改** `apps/mobile/hooks/useChat.ts` — processText 删除 GLM 兜底；sendOcr 新增 ocr_text 响应处理
- **修改** `apps/mobile/app/manual-entry.tsx` — 支持 ocrNote 路由参数
- **修改** `apps/mobile/app/index.tsx` — sendOcr 调用处传入 onOcrText 导航回调

---

## Task 1: record-ocr — 删除 GLM，改用正则提取

**Files:**
- Modify: `supabase/functions/record-ocr/index.ts`

- [ ] **Step 1: 完整替换 record-ocr/index.ts**

用以下内容完整替换文件（删除 GLM_API_KEY、callGlm、buildExtractPrompt、extractJson，新增 extractReceiptInfo）：

```typescript
import { corsHeaders } from "../_shared/cors.ts";

const TENCENT_SECRET_ID = Deno.env.get("TENCENT_SECRET_ID")!;
const TENCENT_SECRET_KEY = Deno.env.get("TENCENT_SECRET_KEY")!;

// ─── 腾讯云 OCR ───
async function recognizeReceipt(imageBase64: string): Promise<string> {
  const tencentcloud = await import("npm:tencentcloud-sdk-nodejs@4");
  const OcrClient = tencentcloud.ocr.v20181119.Client;
  const client = new OcrClient({
    credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
    region: "ap-guangzhou",
  });
  const resp = await client.GeneralBasicOCR({ ImageBase64: imageBase64 });
  return (resp.TextDetections ?? []).map((det: any) => det.DetectedText ?? "").join("\n");
}

// ─── 正则提取收据信息 ───
interface ReceiptInfo {
  amount: number | null;
  merchant: string | null;
  date: string | null;
}

function extractReceiptInfo(ocrText: string): ReceiptInfo {
  // 总金额：多模式依次尝试（兼容 OCR 错字，如"应女金额"="应付金额"）
  const amountPatterns = [
    /应.{0,2}金额[：:]\s*([\d]+\.[\d]{2})/,
    /实.{0,2}付[：:]\s*([\d]+\.[\d]{2})/,
    /合计[：:]?\s*\d+[件个张]?\s*\n?([\d]+\.[\d]{2})/,
    /总计[：:]\s*([\d]+\.[\d]{2})/,
    /小计[：:]\s*([\d]+\.[\d]{2})/,
  ];

  let amount: number | null = null;
  for (const pattern of amountPatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0) { amount = val; break; }
    }
  }

  // 商户名：第一行有意义的文字（排除纯数字/条码行）
  const lines = ocrText.split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 1 && !/^[\d\s\-:.]+$/.test(l));
  const merchant = lines[0] ?? null;

  // 日期：YYYY.M.D 或 YYYY年M月D日
  const dateMatch = ocrText.match(/(\d{4})[.年](\d{1,2})[.月](\d{1,2})/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}T00:00:00`
    : null;

  return { amount, merchant, date };
}

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

    // OCR
    const ocrStart = Date.now();
    console.log(`[OCR] 请求发送 ${new Date(ocrStart).toISOString()}`);
    const ocrText = await recognizeReceipt(imageBase64);
    console.log(`[OCR] 返回 耗时 ${Date.now() - ocrStart}ms`);
    console.log(`[OCR] 内容:\n${ocrText}`);

    if (!ocrText.trim()) {
      return new Response(
        JSON.stringify({ data: { type: "text", message: "无法识别小票内容，请确保图片清晰后重试。" } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 正则提取
    const { amount, merchant, date } = extractReceiptInfo(ocrText);
    console.log(`[EXTRACT] 金额:${amount} 商户:${merchant} 日期:${date}`);

    if (amount !== null && amount > 0) {
      return new Response(
        JSON.stringify({
          data: {
            type: "bill",
            transaction: {
              amount,
              category: "购物",
              note: merchant ?? "",
              type: "expense",
              occurred_at: date ?? new Date().toISOString(),
            },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 正则提取不到金额 → 返回原始文字让用户手动补充
    return new Response(
      JSON.stringify({
        data: {
          type: "ocr_text",
          ocrText,
          merchant,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("record-ocr error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: 部署 record-ocr**

```bash
npx supabase functions deploy record-ocr --no-verify-jwt
```

预期输出：`Deployed Edge Function record-ocr`

- [ ] **Step 3: 验证部署（Supabase Dashboard）**

打开 Supabase Dashboard → Functions → record-ocr → Logs，拍一张小票发送，确认日志中出现：
```
[OCR] 请求发送 ...
[OCR] 返回 耗时 XXXXms
[OCR] 内容: ...
[EXTRACT] 金额:XXX 商户:XXX 日期:XXX
```
且**没有** `[GLM]` 字样。

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/record-ocr/index.ts
git commit -m "feat: record-ocr 去除 GLM，改用正则提取总金额"
```

---

## Task 2: useChat — processText 删除 GLM 兜底

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`（processText 函数，约第 23-117 行）

- [ ] **Step 1: 删除 processText 中的 GLM 兜底代码**

当前 `processText` 在规则引擎未命中后有一段检查网络 + 调用 `/record-text` 的代码（约第 69-116 行）。将从 `// 2. 规则未命中 → 检查网络` 到函数末尾替换为：

```typescript
    // 2. 规则引擎未命中 → 提示手动记账
    console.log('[processText] ⚠️ 规则引擎未命中，提示手动记账');
    await addMessage({
      role: "assistant",
      content_type: "text",
      content: "没识别到记账信息，可以试试「手动记账」。",
    });
  }, [qc, addMessage, createTransaction]);
```

修改后完整的 `processText` 函数：

```typescript
  const processText = useCallback(async (text: string) => {
    console.log('[processText] 输入:', text);

    // 1. 先尝试规则引擎
    const ruleResult = parse(text);
    console.log('[processText] 规则引擎结果:', ruleResult ? JSON.stringify(ruleResult) : '未命中');

    if (ruleResult) {
      const categoriesData = qc.getQueryData<readonly Category[]>(["categories"]);
      const otherName = ruleResult.type === "expense" ? "其他支出" : "其他收入";
      const category = (ruleResult.categoryName
        ? categoriesData?.find(
            (c) => c.name === ruleResult.categoryName && c.type === ruleResult.type
          )
        : null
      ) ?? categoriesData?.find((c) => c.name === otherName);

      if (category) {
        console.log('[processText] ✅ 规则引擎命中 → 分类:', category.name, '| 金额:', ruleResult.amount, '| note:', ruleResult.note);
        const txId = await createTransaction({
          amount: ruleResult.amount,
          category_id: category.id,
          type: ruleResult.type,
          note: ruleResult.note,
          occurred_at: new Date().toISOString(),
          source: "rule",
        });
        await addMessage({
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify({
            id: txId,
            amount: ruleResult.amount,
            type: ruleResult.type,
            note: ruleResult.note,
            category_id: category.id,
            occurred_at: new Date().toISOString(),
          }),
          transaction_id: txId,
        });
        return;
      }
      console.log('[processText] 规则引擎有结果但未匹配分类，提示手动记账');
    }

    // 2. 规则引擎未命中 → 提示手动记账
    console.log('[processText] ⚠️ 规则引擎未命中，提示手动记账');
    await addMessage({
      role: "assistant",
      content_type: "text",
      content: "没识别到记账信息，可以试试「手动记账」。",
    });
  }, [qc, addMessage, createTransaction]);
```

同时删除 `useChat` 函数开头不再需要的 `NetInfo` 导入（如果 sendOcr 也不再用的话先保留，Task 3 后确认）。

- [ ] **Step 2: 同步删除 sendText 的 isLoading 无用状态**

`setLoading` 在 `processText` 中是 GLM 流程里用的（`setLoading(true)` 在 GLM 调用前，`setLoading(false)` 在 finally）。删除 GLM 代码后，`processText` 不再调用 `setLoading`。但 `sendOcr` 仍然会用 `setLoading`，所以保留 `isLoading` state 不动。

- [ ] **Step 3: 手动验证**

重启 Expo dev server，在 App 中输入「这个月花了多少」或任意规则引擎不能识别的句子，应看到：
- 聊天中出现「没识别到记账信息，可以试试「手动记账」。」
- **不再有** 网络请求发出（Metro 终端无 `/record-text` 请求日志）

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useChat.ts
git commit -m "feat: processText 去除 GLM 兜底，规则引擎未命中直接提示手动记账"
```

---

## Task 3: useChat — sendOcr 新增 ocr_text 响应处理

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`（sendOcr 函数，约第 131-200 行）

- [ ] **Step 1: 修改 sendOcr 函数签名，新增 onOcrText 回调**

将函数签名从：
```typescript
const sendOcr = useCallback(async (imageBase64: string, onFail?: (imageMessageId: string) => void) => {
```
改为：
```typescript
const sendOcr = useCallback(async (
  imageBase64: string,
  onFail?: (imageMessageId: string) => void,
  onOcrText?: (merchant: string | null) => void,
) => {
```

- [ ] **Step 2: 在 sendOcr 的响应处理中新增 ocr_text 分支**

将当前的：
```typescript
      if (resp.data?.type === "bill") {
        // ...existing bill handling...
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        console.log('[sendOcr] ⚠️ OCR 未识别:', resp.data?.message);
        await addMessage({ role: "assistant", content_type: "text", content: resp.data?.message ?? "小票识别失败，请手动记账。" });
        onFail?.(imageMessageId);
      }
```

改为：
```typescript
      if (resp.data?.type === "bill") {
        const tx = resp.data.transaction;
        const categoriesData = qc.getQueryData<readonly Category[]>(["categories"]);
        const otherName = tx.type === "income" ? "其他收入" : "其他支出";
        const category = (tx.category
          ? categoriesData?.find((c) => c.name === tx.category && c.type === tx.type)
          : null
        ) ?? categoriesData?.find((c) => c.name === otherName);
        const txId = await createTransaction({
          amount: tx.amount,
          category_id: category?.id ?? "",
          type: tx.type,
          note: tx.note ?? "",
          occurred_at: tx.occurred_at ?? new Date().toISOString(),
          source: "ocr",
        });
        console.log('[sendOcr] ✅ OCR 记账 → 分类:', category?.name, '| 金额:', tx.amount, '| note:', tx.note);
        await addMessage({
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify({
            id: txId,
            amount: tx.amount,
            type: tx.type,
            note: tx.note ?? "",
            category_id: category?.id,
            occurred_at: tx.occurred_at ?? new Date().toISOString(),
          }),
          transaction_id: txId,
        });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else if (resp.data?.type === "ocr_text") {
        // 识别到文字但正则提取不到金额 → 提示 + 导航到手动记账
        console.log('[sendOcr] ℹ️ OCR 有文字但无金额，merchant:', resp.data.merchant);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: resp.data.merchant
            ? `已识别商户「${resp.data.merchant}」，请手动补充金额完成记账。`
            : "已识别小票内容，请手动补充金额完成记账。",
        });
        onOcrText?.(resp.data.merchant ?? null);
      } else {
        console.log('[sendOcr] ⚠️ OCR 未识别:', resp.data?.message);
        await addMessage({ role: "assistant", content_type: "text", content: resp.data?.message ?? "小票识别失败，请手动记账。" });
        onFail?.(imageMessageId);
      }
```

- [ ] **Step 3: 确认 useChat 返回值包含新签名**

函数末尾 `return { sendText, sendOcr, sendAsr, isLoading };` 不需要改动，`sendOcr` 类型会自动推导新签名。

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useChat.ts
git commit -m "feat: sendOcr 新增 ocr_text 响应处理和 onOcrText 回调"
```

---

## Task 4: manual-entry + index.tsx — 接入 ocrNote 参数

**Files:**
- Modify: `apps/mobile/app/manual-entry.tsx`（第 47、60 行）
- Modify: `apps/mobile/app/index.tsx`（onCamera 和 handleResendOcr）

### manual-entry.tsx

- [ ] **Step 1: 新增 ocrNote 到 params 类型**

将第 47 行：
```typescript
  const params = useLocalSearchParams<{ txId?: string; txData?: string; msgId?: string }>();
```
改为：
```typescript
  const params = useLocalSearchParams<{ txId?: string; txData?: string; msgId?: string; ocrNote?: string }>();
```

- [ ] **Step 2: note 初始值读取 ocrNote**

将第 60 行：
```typescript
  const [note, setNote] = useState("");
```
改为：
```typescript
  const [note, setNote] = useState(() => params.ocrNote ?? "");
```

（`useEffect` 中的 `setNote(transaction.note || "")` 只在 `isEdit` 时触发，不影响新建场景。）

### index.tsx

- [ ] **Step 3: 更新 onCamera 传入 onOcrText 回调**

将 `ChatInputBar` 的 `onCamera` prop：
```typescript
onCamera={async () => {
  const base64 = await pickImage();
  if (base64) sendOcr(base64, onOcrFail);
}}
```
改为：
```typescript
onCamera={async () => {
  const base64 = await pickImage();
  if (base64) sendOcr(base64, onOcrFail, (merchant) => {
    router.push({
      pathname: "/manual-entry",
      params: { ocrNote: merchant ?? "" },
    });
  });
}}
```

- [ ] **Step 4: 更新 handleResendOcr 传入 onOcrText 回调**

将 `handleResendOcr` 中的 `sendOcr(base64, onOcrFail)` 改为：
```typescript
  async function handleResendOcr(imagePath: string, imageMessageId: string) {
    setFailedOcrIds((prev) => {
      const next = new Set(prev);
      next.delete(imageMessageId);
      return next;
    });
    try {
      const base64 = await FileSystem.readAsStringAsync(imagePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      sendOcr(base64, onOcrFail, (merchant) => {
        router.push({
          pathname: "/manual-entry",
          params: { ocrNote: merchant ?? "" },
        });
      });
    } catch {
      setFailedOcrIds((prev) => new Set(prev).add(imageMessageId));
    }
  }
```

- [ ] **Step 5: 手动验证 ocrNote 预填**

拍一张识别不到金额但识别到商户名的图片（比如名片或不标准小票），应看到：
- 聊天中出现「已识别商户「XXX」，请手动补充金额完成记账。」
- 自动跳转手动记账页面，备注字段已预填商户名

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/manual-entry.tsx apps/mobile/app/index.tsx
git commit -m "feat: manual-entry 支持 ocrNote 预填，index 接入 onOcrText 导航回调"
```

---

## Task 5: 端到端验证

- [ ] **Step 1: 验证标准小票（正则命中）**

拍一张超市/餐厅小票，预期：
- 聊天中出现图片气泡 + TypingIndicator
- ~3s 内出现账单卡片，金额 = 小票总金额，备注 = 商户名，分类 = 购物
- Supabase Logs 显示 `[EXTRACT] 金额:XXX` 且无 `[GLM]`

- [ ] **Step 2: 验证正则未命中（识别到文字但无金额）**

拍一张手写票或格式混乱的图片，预期：
- 聊天出现图片气泡
- 出现「已识别商户...请手动补充金额」文字消息
- 自动跳转手动记账，备注已预填（如果商户名识别到的话）

- [ ] **Step 3: 验证 ASR 规则引擎未命中**

说一句「今天心情不好」（规则引擎不会命中），预期：
- 出现「没识别到记账信息，可以试试「手动记账」。」
- Metro 终端无 `/record-text` 请求
