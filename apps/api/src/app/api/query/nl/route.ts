import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient, createServiceClient } from "@/lib/supabase";
import { getTimezone, getCurrentTimeInZone } from "@/lib/timezone";
import { callGlm, buildText2SqlPrompt, buildSummarizePrompt, parseSqlResponse, validateSql } from "@coco/ai";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { question } = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);
  const tz = getTimezone(req);
  const now = getCurrentTimeInZone(tz);
  const glmOptions = { apiKey: process.env.GLM_API_KEY! };

  try {
    const sqlResp = await callGlm(buildText2SqlPrompt(question, now), glmOptions);
    const sql = parseSqlResponse(sqlResp.content);

    if (!validateSql(sql)) {
      return NextResponse.json({
        success: true, data: { message: "无法理解你的问题，请换个问法。" }, error: null,
      });
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(auth.userId)) {
      return NextResponse.json({ success: false, data: null, error: "Invalid user" }, { status: 403 });
    }

    // CTE wrapping: replace transactions with scoped to enforce user_id filtering
    const wrappedSql = `WITH scoped AS (SELECT * FROM transactions WHERE user_id = '${auth.userId}' AND deleted_at IS NULL) ${sql.replace(/\btransactions\b/gi, "scoped")}`;

    const serviceClient = createServiceClient();
    const { data: queryResult, error: queryError } = await serviceClient.rpc("exec_readonly_sql", {
      sql_query: wrappedSql,
    });

    if (queryError) {
      return NextResponse.json({ success: false, data: null, error: queryError.message }, { status: 500 });
    }

    const summaryResp = await callGlm(
      buildSummarizePrompt(question, JSON.stringify(queryResult ?? [])),
      glmOptions
    );

    // Save NL query log
    await createServiceClient().from("nl_query_logs").insert({
      user_id: auth.userId, question, generated_sql: sql, result_summary: summaryResp.content,
    });

    return NextResponse.json({
      success: true, data: { message: summaryResp.content }, error: null,
    });
  } catch {
    return NextResponse.json({ success: false, data: null, error: "Query failed" }, { status: 500 });
  }
}
