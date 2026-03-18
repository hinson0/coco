import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";

export const GET = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");

  const supabase = createServiceClient();

  let query = supabase
    .from("transactions")
    .select("amount, type, category_id, categories(name, icon), occurred_at")
    .eq("user_id", auth.userId)
    .is("deleted_at", null);

  if (startDate) query = query.gte("occurred_at", startDate);
  if (endDate) query = query.lte("occurred_at", endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  const totalIncome = (data ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = (data ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryMap = (data ?? []).reduce<Record<string, { name: string; icon: string; amount: number; type: string }>>((acc, t) => {
    const cat = (t as any).categories;
    const key = t.category_id;
    if (!acc[key]) acc[key] = { name: cat?.name ?? "未知", icon: cat?.icon ?? "📦", amount: 0, type: t.type };
    acc[key].amount += Number(t.amount);
    return acc;
  }, {});

  const categoryBreakdown = Object.values(categoryMap)
    .sort((a, b) => b.amount - a.amount)
    .map((cat) => {
      const total = cat.type === "income" ? totalIncome : totalExpense;
      return {
        ...cat,
        percentage: total > 0 ? Math.round((cat.amount / total) * 100) : 0,
      };
    });

  return NextResponse.json({
    success: true,
    data: { totalIncome, totalExpense, balance: totalIncome - totalExpense, categoryBreakdown },
    error: null,
  });
});
