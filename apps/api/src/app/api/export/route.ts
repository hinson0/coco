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
    .select("amount, type, note, occurred_at, source, categories(name)")
    .eq("user_id", auth.userId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  if (startDate) query = query.gte("occurred_at", startDate);
  if (endDate) query = query.lte("occurred_at", endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  const escapeCsv = (val: string) => {
    if (/[,"\n\r]/.test(val) || /^[=+\-@]/.test(val)) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvHeader = "日期,类型,分类,金额,备注,来源";
  const csvRows = (data ?? []).map((t) => {
    const cat = (t as any).categories?.name ?? "未知";
    const typeLabel = t.type === "income" ? "收入" : "支出";
    return [t.occurred_at, typeLabel, cat, String(t.amount), t.note ?? "", t.source]
      .map(escapeCsv)
      .join(",");
  });

  const csv = [csvHeader, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=coco-export.csv",
    },
  });
});
