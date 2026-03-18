import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";
import type { ApiResponse, Category, CreateCategoryInput } from "@coco/shared";

export const GET = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data, error: null } satisfies ApiResponse<Category[]>);
});

export const POST = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body: CreateCategoryInput = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...body, user_id: auth.userId, is_default: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data, error: null } satisfies ApiResponse<Category>,
    { status: 201 }
  );
});
