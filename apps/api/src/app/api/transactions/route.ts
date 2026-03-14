import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { PaginatedResponse, Transaction, CreateTransactionInput } from "@coco/shared";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = (page - 1) * limit;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error, count } = await supabase
    .from("transactions")
    .select("*, categories(name, icon)", { count: "exact" })
    .eq("user_id", auth.userId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, data: [], total: 0, page, limit } satisfies PaginatedResponse<never>,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true, data: data ?? [], total: count ?? 0, page, limit,
  } satisfies PaginatedResponse<Transaction>);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateTransactionInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...body, user_id: auth.userId })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data, error: null }, { status: 201 });
}
