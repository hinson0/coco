import { corsHeaders } from "../_shared/cors.ts";

const TENCENT_SECRET_ID = Deno.env.get("TENCENT_SECRET_ID")!;
const TENCENT_SECRET_KEY = Deno.env.get("TENCENT_SECRET_KEY")!;
const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;

// ─── 腾讯云 ASR ───
async function recognizeSpeech(audioBase64: string): Promise<string> {
  const tencentcloud = await import("npm:tencentcloud-sdk-nodejs@4");
  const AsrClient = tencentcloud.asr.v20190614.Client;
  const client = new AsrClient({
    credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
    region: "ap-guangzhou",
  });
  const resp = await client.SentenceRecognition({
    EngSerViceType: "16k_zh",
    SourceType: 1,
    VoiceFormat: "wav",
    Data: audioBase64,
    DataLen: new Uint8Array(atob(audioBase64).split("").map((c) => c.charCodeAt(0))).length,
  });
  return resp.Result ?? "";
}

// ─── GLM 调用 ───
async function callGlm(prompt: string): Promise<string> {
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_API_KEY}` },
    body: JSON.stringify({ model: "glm-4.7-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`GLM API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── 记账 JSON 提取 prompt ───
function buildExtractPrompt(asrText: string): string {
  const now = new Date().toISOString();
  return `从以下语音转文字内容中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}

规则：
- amount: 金额数值
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述
- type: "income" 如果是收入（工资、理财等），否则 "expense"
- occurred_at: ISO 8601 格式，相对日期请基于当前时间计算

当前时间：${now}
只返回 JSON，不要其他文字。

语音内容：${asrText}`;
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

// ─── Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audioBase64 } = await req.json();
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "Missing audioBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. ASR
    const asrText = await recognizeSpeech(audioBase64);
    if (!asrText.trim()) {
      return new Response(JSON.stringify({ data: { type: "text", message: "没听清，要不再说一次？", asrText: "" } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. GLM 提取完整记账信息
    const glmRaw = await callGlm(buildExtractPrompt(asrText));
    const parsed = extractJson(glmRaw);

    if (parsed && typeof parsed.amount === "number" && parsed.amount > 0) {
      return new Response(JSON.stringify({
        data: {
          type: "bill",
          asrText,
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
      data: { type: "text", message: `识别到："${asrText}"，但无法提取记账信息。请再试一次。`, asrText },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-asr error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
