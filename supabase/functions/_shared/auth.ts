// supabase/functions/_shared/auth.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUserFromRequest(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}
