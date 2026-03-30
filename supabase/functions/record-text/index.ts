import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw.match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function buildIntentPrompt(text: string): string {
  return `判断以下用户输入的意图，返回 JSON：{"intent": "record"} 或 {"intent": "query"}。
- record：用户在描述一笔消费或收入（如"午饭35"、"打车花了20"、"收到工资5000"）
- query：用户在查询历史数据（如"上周花了多少"、"本月餐饮支出"）

只返回 JSON，不要其他文字。

用户输入：${text}`;
}

function buildRecordPrompt(text: string): string {
  const now = new Date().toISOString();
  return `从以下文字中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}

规则：
- amount: 金额数值
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 消费/收入的事项（如"咖啡""打车""工资"），不要包含金额和数字
- type: "income" 如果是收入，否则 "expense"
- occurred_at: ISO 8601 格式，相对日期请基于当前时间计算

当前时间：${now}
只返回 JSON，不要其他文字。

文字内容：${text}`;
}

function buildQueryPrompt(question: string): string {
  const now = new Date().toISOString();
  return `将以下自然语言问题转换为 PostgreSQL SELECT 查询。

可用表结构：
- transactions (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, deleted_at)
  - type: 'income' | 'expense'
  - deleted_at IS NULL 表示未删除
- categories (id, user_id, name, icon, type, is_default)

规则：
- 只生成 SELECT 语句
- 必须包含 WHERE deleted_at IS NULL
- 不要包含 user_id 条件（服务端自动注入）
- 使用 JOIN categories ON transactions.category_id = categories.id 来按分类名过滤
- 当前时间：${now}

只返回 SQL，不要其他文字。

问题：${question}`;
}

function buildSummarizePrompt(question: string, queryResult: string): string {
  return `用户问："${question}"

查询结果如下：
${queryResult}

请用简洁的中文自然语言回答用户的问题。如果结果为空，说"没有找到相关记录"。
包含具体数字和关键细节。`;
}

function extractSql(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:sql)?\s*\n?([\s\S]*?)\n?```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
}

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

    const { text } = await req.json();
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. 意图分类
    const intentRaw = await callGlm(buildIntentPrompt(text));
    const intentParsed = extractJson(intentRaw);
    const intent = intentParsed?.intent === "query" ? "query" : "record";

    if (intent === "record") {
      // 2a. 记账
      const glmRaw = await callGlm(buildRecordPrompt(text));
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
        data: { type: "text", message: "没有识别到记账信息，请再描述一下。" },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b. 查询
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sqlRaw = await callGlm(buildQueryPrompt(text));
    let sql = extractSql(sqlRaw);

    sql = sql.replace(
      /WHERE\s+/i,
      `WHERE transactions.user_id = '${user.id}' AND `,
    );

    const { data: queryResult, error: queryError } = await supabase.rpc("exec_readonly_sql", { sql_text: sql });

    if (queryError) {
      return new Response(JSON.stringify({
        data: { type: "text", message: "查询出错，请换个方式描述。" },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summaryRaw = await callGlm(buildSummarizePrompt(text, JSON.stringify(queryResult)));

    return new Response(JSON.stringify({
      data: { type: "nl_result", message: summaryRaw },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-text error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
