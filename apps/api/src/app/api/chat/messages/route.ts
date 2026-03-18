import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";

export const GET = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = (page - 1) * limit;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error, count } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact" })
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, data: [], total: 0, page, limit },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, limit });
});
