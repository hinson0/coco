import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import type { ApiResponse, Category } from "@coco/shared";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("categories")
    .update(body)
    .eq("id", params.id)
    .eq("is_default", false)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data, error: null } satisfies ApiResponse<Category>);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", params.id)
    .eq("is_default", false);

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: null, error: null } satisfies ApiResponse<null>);
}
