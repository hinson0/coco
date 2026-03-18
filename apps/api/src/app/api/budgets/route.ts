import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";
import type { CreateBudgetInput } from "@coco/shared";

export const GET = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("*, categories(name, icon)")
    .eq("user_id", auth.userId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  const now = new Date();
  const budgetsWithSpent = await Promise.all(
    (budgets ?? []).map(async (budget) => {
      const periodStart = new Date(now);
      if (budget.period === "weekly") periodStart.setDate(now.getDate() - 7);
      else if (budget.period === "monthly") periodStart.setMonth(now.getMonth() - 1);
      else periodStart.setFullYear(now.getFullYear() - 1);

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount")
        .eq("category_id", budget.category_id)
        .eq("type", "expense")
        .is("deleted_at", null)
        .gte("occurred_at", periodStart.toISOString());

      const spent = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
      return { ...budget, spent };
    })
  );

  return NextResponse.json({ success: true, data: budgetsWithSpent, error: null });
});

export const POST = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateBudgetInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { ...body, user_id: auth.userId },
      { onConflict: "user_id,category_id,period" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data, error: null }, { status: 201 });
});
