import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { withLogger } from "@/lib/logger";
import { callGlm, buildText2SqlPrompt, buildSummarizePrompt, parseSqlResponse, validateSql } from "@coco/ai";

export const POST = withLogger(async (req, { tracker }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { question } = await req.json();
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);
  const glmOptions = { apiKey: process.env.GLM_API_KEY! };

  try {
    const sqlResp = await tracker.step("GLM text2sql", () =>
      callGlm(buildText2SqlPrompt(question, now), glmOptions)
    );
    const sql = parseSqlResponse(sqlResp.content);

    if (!validateSql(sql)) {
      return NextResponse.json({
        success: true, data: { message: "无法理解你的问题，请换个问法。" }, error: null,
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(auth.userId)) {
      return NextResponse.json({ success: false, data: null, error: "Invalid user" }, { status: 403 });
    }

    const wrappedSql = `WITH scoped AS (SELECT * FROM transactions WHERE user_id = '${auth.userId}' AND deleted_at IS NULL) ${sql.replace(/\btransactions\b/gi, "scoped")}`;

    const serviceClient = createServiceClient();
    const { data: queryResult, error: queryError } = await tracker.step("DB query", () =>
      serviceClient.rpc("exec_readonly_sql", { sql_query: wrappedSql })
    );

    if (queryError) {
      return NextResponse.json({ success: false, data: null, error: queryError.message }, { status: 500 });
    }

    const summaryResp = await tracker.step("GLM summarize", () =>
      callGlm(buildSummarizePrompt(question, JSON.stringify(queryResult ?? [])), glmOptions)
    );

    await serviceClient.from("nl_query_logs").insert({
      user_id: auth.userId, question, generated_sql: sql, result_summary: summaryResp.content,
    });

    return NextResponse.json({
      success: true, data: { message: summaryResp.content }, error: null,
    });
  } catch {
    return NextResponse.json({ success: false, data: null, error: "Query failed" }, { status: 500 });
  }
});
