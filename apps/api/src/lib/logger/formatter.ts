import type { Step } from "./tracker";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
} as const;

const methodColor: Record<string, string> = {
  GET: c.green,
  POST: c.blue,
  PUT: c.yellow,
  PATCH: c.yellow,
  DELETE: c.red,
};

function statusColor(status: number): string {
  if (status < 300) return c.green;
  if (status < 400) return c.cyan;
  if (status < 500) return c.yellow;
  return c.red;
}

function durationColor(ms: number): string {
  if (ms < 200) return c.green;
  if (ms < 1000) return c.yellow;
  return c.red;
}

export interface LogEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  params: string | null;
  steps: ReadonlyArray<Step>;
  error?: Error;
}

export function formatLog(entry: LogEntry): string {
  const lines: string[] = [];

  const mc = methodColor[entry.method] ?? c.white;
  const sc = statusColor(entry.status);
  const dc = durationColor(entry.duration);
  const method = entry.method.padEnd(7);

  lines.push(
    `${c.dim}←${c.reset} ${mc}${c.bold}${method}${c.reset}${entry.path} ${sc}${entry.status}${c.reset} ${dc}${entry.duration}ms${c.reset}`
  );

  const hasSteps = entry.steps.length > 0;
  const hasError = !!entry.error;

  if (entry.params) {
    const connector = hasSteps || hasError ? "│" : " ";
    lines.push(`  ${c.dim}${connector}${c.reset} ${c.gray}${entry.params}${c.reset}`);
  }

  if (hasSteps) {
    const maxNameLen = Math.max(...entry.steps.map((s) => s.name.length));

    entry.steps.forEach((step, i) => {
      const isLast = i === entry.steps.length - 1 && !hasError;
      const connector = isLast ? "└" : "├";
      const name = step.name.padEnd(maxNameLen);
      const sdc = durationColor(step.durationMs);
      const dur = String(step.durationMs).padStart(5);
      const fail = step.failed ? ` ${c.red}✗${c.reset}` : "";

      lines.push(
        `  ${c.dim}${connector}${c.reset} ${name}  ${sdc}${dur}ms${c.reset}${fail}`
      );
    });
  }

  if (entry.error) {
    lines.push(`  ${c.red}✗ ${entry.error.message}${c.reset}`);
    if (entry.error.stack) {
      const stackLines = entry.error.stack
        .split("\n")
        .slice(1, 4)
        .map((l) => `    ${c.dim}${l.trim()}${c.reset}`);
      lines.push(...stackLines);
    }
  }

  return lines.join("\n");
}
