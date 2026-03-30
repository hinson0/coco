import { corsHeaders } from "../_shared/cors.ts";

const TENCENT_SECRET_ID = Deno.env.get("TENCENT_SECRET_ID")!;
const TENCENT_SECRET_KEY = Deno.env.get("TENCENT_SECRET_KEY")!;
const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;

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

// ─── GLM 调用 ───
async function callGlm(prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_API_KEY}` },
      body: JSON.stringify({ model: "glm-4.7-flash", messages: [{ role: "user", content: prompt }] }),
    });
    if (response.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!response.ok) throw new Error(`GLM API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }
  throw new Error("GLM API 限流，请稍后重试");
}

function buildExtractPrompt(ocrText: string): string {
  return `从以下 OCR 文本中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}

规则：
- amount: 金额数值，不含货币符号
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述（如商户名称+商品）
- type: "income" 如果是收入，否则 "expense"
- occurred_at: ISO 8601 格式日期，无法识别则返回 null

只返回 JSON，不要其他文字。

OCR文本：${ocrText}`;
}

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw.match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
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

    // 1. OCR
    const ocrText = await recognizeReceipt(imageBase64);
    if (!ocrText.trim()) {
      return new Response(JSON.stringify({ data: { type: "text", message: "无法识别小票内容，请确保图片清晰后重试。" } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. GLM 提取
    const glmRaw = await callGlm(buildExtractPrompt(ocrText));
    const parsed = extractJson(glmRaw);

    if (parsed && typeof parsed.amount === "number" && parsed.amount > 0) {
      return new Response(JSON.stringify({
        data: {
          type: "bill",
          transaction: {
            amount: parsed.amount,
            category: parsed.category ?? "其他支出",
            note: parsed.note ?? "",
            type: parsed.type === "income" ? "income" : "expense",
            occurred_at: parsed.occurred_at ?? new Date().toISOString(),
          },
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      data: { type: "text", message: "小票识别失败，请手动记账。" },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-ocr error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
