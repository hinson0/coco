import { NextRequest } from "next/server";

export function getTimezone(req: NextRequest): string {
  return req.headers.get("X-Timezone") ?? "Asia/Shanghai";
}

export function getCurrentTimeInZone(timezone: string): string {
  return new Date().toLocaleString("sv-SE", { timeZone: timezone }).replace(" ", "T");
}
