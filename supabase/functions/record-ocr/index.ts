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
  return (resp.TextDetections ?? []).map((det) => det.DetectedText ?? "").join("\n");
}

// ─── 正则提取收据信息 ───
interface ReceiptInfo {
  amount: number | null;
  merchant: string | null;
  date: string | null;
}

function extractReceiptInfo(ocrText: string): ReceiptInfo {
  // 总金额：多模式依次尝试，取最后一次匹配（避免子合计误命中）
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

  let amount: number | null = null;
  for (const pattern of amountPatterns) {
    const matches = [...ocrText.matchAll(new RegExp(pattern.source, "g"))];
    const match = matches[matches.length - 1] ?? null;
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

  // 日期：优先 YYYY-MM-DD（医院/餐厅），fallback YYYY.M.D 或 YYYY年M月D日
  const isoMatch = ocrText.match(/(\d{4})-(\d{2})-(\d{2})/);
  const dotMatch = ocrText.match(/(\d{4})[.年](\d{1,2})[.月](\d{1,2})/);
  const dateMatch = isoMatch ?? dotMatch;
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}T00:00:00Z`
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
