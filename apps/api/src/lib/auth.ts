import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "./supabase";
import type { ApiResponse } from "@coco/shared";

export async function authenticateRequest(
  req: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, data: null, error: "Missing auth token" } satisfies ApiResponse<null>,
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json(
      { success: false, data: null, error: "Invalid token" } satisfies ApiResponse<null>,
      { status: 401 }
    );
  }

  return { userId: data.user.id };
}
