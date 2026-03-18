import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { withLogger } from "@/lib/logger";
import { callGlm, buildAsrExtractPrompt, parseRecordResponse, recognizeSpeech } from "@coco/ai";

export const POST = withLogger(async (req, { tracker }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { audioBase64 } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);

  await supabase.from("chat_messages").insert({
    user_id: auth.userId, role: "user", content_type: "audio", content: "[voice message]",
  });

  try {
    const asrResult = await tracker.step("Tencent ASR", () =>
      recognizeSpeech(audioBase64, {
        secretId: process.env.TENCENT_SECRET_ID!,
        secretKey: process.env.TENCENT_SECRET_KEY!,
      })
    );

    const glmResp = await tracker.step("GLM extract", () =>
      callGlm(buildAsrExtractPrompt(asrResult.text, now), { apiKey: process.env.GLM_API_KEY! })
    );
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

    const { data: tx, error: txError } = await tracker.step("DB insert", () =>
      supabase
        .from("transactions")
        .insert({
          user_id: auth.userId, category_id: categoryId, amount: parsed.amount,
          type: parsed.type, note: parsed.note,
          occurred_at: parsed.occurred_at ?? new Date().toISOString(),
          source: "asr", raw_input: asrResult.text, ai_confidence: 0.7,
        })
        .select("*, categories(name, icon)")
        .single()
    );

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
});
