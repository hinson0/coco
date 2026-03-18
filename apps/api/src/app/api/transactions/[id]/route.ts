import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";

export const PATCH = withLogger(async (req, { params }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { amount, category_id, note, type, occurred_at } = body;
  const safeBody = { amount, category_id, note, type, occurred_at };

  const { data, error } = await supabase
    .from("transactions")
    .update(safeBody)
    .eq("id", params.id)
    .eq("user_id", auth.userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data, error: null });
});

export const DELETE = withLogger(async (req, { params }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ success: false, data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: null, error: null });
});
