import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient, createServiceClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { withLogger } from "@/lib/logger";
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

export const POST = withLogger(async (req, { tracker }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { text } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const glmOptions = { apiKey: process.env.GLM_API_KEY! };
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);

  await supabase.from("chat_messages").insert({
    user_id: auth.userId, role: "user", content_type: "text", content: text,
  });

  const intentResp = await tracker.step("GLM intent", () =>
    callGlm(buildIntentClassifyPrompt(text), glmOptions)
  );
  const intent = parseIntentResponse(intentResp.content);

  if (intent === "query") {
    try {
      const sqlResp = await tracker.step("GLM text2sql", () =>
        callGlm(buildText2SqlPrompt(text, now), glmOptions)
      );
      const sql = parseSqlResponse(sqlResp.content);

      if (!validateSql(sql)) {
        await supabase.from("chat_messages").insert({
          user_id: auth.userId, role: "assistant", content_type: "text",
          content: "无法理解你的问题，请换个问法试试。",
        });
        return NextResponse.json({ success: true, data: { type: "nl_error", message: "无法理解，请换个问法" }, error: null });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(auth.userId)) {
        return NextResponse.json({ success: false, data: null, error: "Invalid user" }, { status: 403 });
      }

      const wrappedSql = `WITH scoped AS (SELECT * FROM transactions WHERE user_id = '${auth.userId}' AND deleted_at IS NULL) ${sql.replace(/\btransactions\b/gi, "scoped")}`;

      const serviceClient = createServiceClient();
      const { data: queryResult } = await tracker.step("DB query", () =>
        serviceClient.rpc("exec_readonly_sql", { sql_query: wrappedSql })
      );

      const summaryResp = await tracker.step("GLM summarize", () =>
        callGlm(buildSummarizePrompt(text, JSON.stringify(queryResult ?? [])), glmOptions)
      );

      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "nl_result", content: summaryResp.content,
      });

      await serviceClient.from("nl_query_logs").insert({
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

  try {
    const extractResp = await tracker.step("GLM extract", () =>
      callGlm(buildAsrExtractPrompt(text, now), glmOptions)
    );
    const parsed = parseRecordResponse(extractResp.content);

    if (!parsed) {
      await supabase.from("chat_messages").insert({
        user_id: auth.userId, role: "assistant", content_type: "text", content: "没听懂，要不换个说法？或者试试手动记账。",
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
      user_id: auth.userId, role: "assistant", content_type: "text", content: "识别失败，请手动记账。",
    });
    return NextResponse.json({ success: false, data: null, error: "Parse failed" }, { status: 500 });
  }
});
