import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { ApiResponse, Category, CreateCategoryInput } from "@coco/shared";

export async function GET(req: NextRequest) {
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
}

export async function POST(req: NextRequest) {
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
}
