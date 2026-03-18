import { NextRequest, NextResponse } from "next/server";
import { createTracker, type Tracker } from "./tracker";
import { formatLog } from "./formatter";

export interface LoggerContext {
  tracker: Tracker;
  params: Record<string, string>;
}

type LoggedHandler = (
  req: NextRequest,
  ctx: LoggerContext,
) => Promise<NextResponse | Response>;

function summarizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && value.length > 500) {
      const sizeKB = ((value.length * 3) / 4 / 1024).toFixed(1);
      if (key.toLowerCase().includes("image")) {
        result[key] = `[image ${sizeKB}KB]`;
      } else if (key.toLowerCase().includes("audio")) {
        result[key] = `[audio ${sizeKB}KB]`;
      } else {
        result[key] = `[binary ${sizeKB}KB]`;
      }
    } else if (typeof value === "string" && value.length > 100) {
      result[key] = value.slice(0, 100) + "...";
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function extractParams(req: NextRequest): Promise<string | null> {
  if (req.method === "GET" || req.method === "DELETE" || req.method === "HEAD") {
    const entries = [...req.nextUrl.searchParams.entries()];
    if (entries.length === 0) return null;
    return "query: " + entries.map(([k, v]) => `${k}=${v}`).join(" ");
  }

  try {
    const body = await req.clone().json();
    return "body: " + JSON.stringify(summarizeBody(body));
  } catch {
    return null;
  }
}

export function withLogger(handler: LoggedHandler) {
  return async function loggedHandler(
    req: NextRequest,
    routeCtx?: { params?: Record<string, string> },
  ): Promise<NextResponse | Response> {
    const start = performance.now();
    const tracker = createTracker();
    const ctx: LoggerContext = {
      tracker,
      params: routeCtx?.params ?? {},
    };

    const paramStr = await extractParams(req);

    try {
      const response = await handler(req, ctx);
      const duration = Math.round(performance.now() - start);

      console.log(
        formatLog({
          method: req.method,
          path: req.nextUrl.pathname,
          status: response.status,
          duration,
          params: paramStr,
          steps: tracker.getSteps(),
        })
      );

      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - start);

      console.log(
        formatLog({
          method: req.method,
          path: req.nextUrl.pathname,
          status: 500,
          duration,
          params: paramStr,
          steps: tracker.getSteps(),
          error: error instanceof Error ? error : new Error(String(error)),
        })
      );

      return NextResponse.json(
        { success: false, data: null, error: "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
