import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";
import type { CreateTransactionInput } from "@coco/shared";

export const POST = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateTransactionInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({ ...body, user_id: auth.userId, source: body.source ?? "manual" })
    .select("*, categories(name, icon)")
    .single();

  if (txError) {
    return NextResponse.json({ success: false, data: null, error: txError.message }, { status: 500 });
  }

  if (!body.skip_chat) {
    await supabase.from("chat_messages").insert([
      { user_id: auth.userId, role: "user", content_type: "text", content: `手动记账: ${body.note} ¥${body.amount}` },
      { user_id: auth.userId, role: "assistant", content_type: "bill_card", content: JSON.stringify(tx), transaction_id: tx.id },
    ]);
  }

  return NextResponse.json({ success: true, data: tx, error: null }, { status: 201 });
});
