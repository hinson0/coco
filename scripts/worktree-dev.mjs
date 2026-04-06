#!/usr/bin/env node
// scripts/worktree-dev.mjs — worktree 一键启动（env + 依赖 + 前后端并发）

import { execSync, spawn } from "child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

// ── CLI 参数解析 ──────────────────────────────

export function parseArgs(argv) {
  const args = argv.slice(2);
  const name = args.find((a, i) => {
    if (a.startsWith("--")) return false;
    if (i > 0 && args[i - 1] === "--port") return false;
    return true;
  });
  if (!name) {
    throw new Error("用法: pnpm worktree <name> [--port <backendPort>]");
  }

  const portIdx = args.indexOf("--port");
  const backendPort = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 8000;
  if (isNaN(backendPort)) {
    throw new Error("--port 必须是数字");
  }
  const frontendPort = backendPort + 80;

  return { name, backendPort, frontendPort };
}

// ── Env 符号链接 ──────────────────────────────

export function ensureEnvSymlinks(cwd, wtDir) {
  const envPairs = [
    {
      link: resolve(wtDir, "apps/backend/.env"),
      target: resolve(cwd, "apps/backend/.env"),
    },
    {
      link: resolve(wtDir, "apps/mobile/.env"),
      target: resolve(cwd, "apps/mobile/.env"),
    },
  ];

  for (const { link, target } of envPairs) {
    if (lstatSync(link, { throwIfNoEntry: false })) {
      continue;
    }
    if (!existsSync(target)) {
      throw new Error(`找不到 env 文件: ${target}`);
    }
    symlinkSync(target, link);
  }
}

// ── 依赖安装 ──────────────────────────────────

function ensureDeps(wtDir) {
  const run = (cmd, opts = {}) =>
    execSync(cmd, { stdio: "inherit", ...opts });

  if (!existsSync(resolve(wtDir, "node_modules"))) {
    console.log("📦 安装前端依赖...");
    run("pnpm install", { cwd: wtDir });
  }

  const backendDir = resolve(wtDir, "apps/backend");
  if (!existsSync(resolve(backendDir, ".venv"))) {
    console.log("📦 安装 Python 依赖...");
    run("uv sync", { cwd: backendDir });
  }
}

// ── 带前缀的进程输出 ──────────────────────────

function spawnWithPrefix(cmd, args, opts, prefix, colorCode, onExit) {
  const reset = "\x1b[0m";
  const tag = `${colorCode}[${prefix}]${reset} `;

  const proc = spawn(cmd, args, {
    ...opts,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const pipeLine = (stream, target) => {
    let buffer = "";
    stream.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        target.write(tag + line + "\n");
      }
    });
    stream.on("end", () => {
      if (buffer) target.write(tag + buffer + "\n");
    });
  };

  pipeLine(proc.stdout, process.stdout);
  pipeLine(proc.stderr, process.stderr);

  proc.on("exit", (code) => {
    console.log(`${tag}进程退出 (code: ${code})`);
    if (onExit) onExit(code);
  });

  return proc;
}

// ── 主流程 ────────────────────────────────────

function main() {
  let restoreFn = null;

  try {
    const { name, backendPort, frontendPort } = parseArgs(process.argv);
    const cwd = process.cwd();
    const wtDir = resolve(cwd, ".claude/worktrees", name);

    if (!existsSync(wtDir)) {
      console.error(`❌ worktree 不存在: ${wtDir}`);
      process.exit(1);
    }

    // 1. Env symlinks
    ensureEnvSymlinks(cwd, wtDir);

    // 2. 依赖安装
    ensureDeps(wtDir);

    // 3. 修改 mobile name（区分多 worktree）
    const wtName = `worktree-${name}`;
    const mobileDir = resolve(wtDir, "apps/mobile");
    const backendDir = resolve(wtDir, "apps/backend");

    const mobilePkgPath = resolve(mobileDir, "package.json");
    const originalPkg = readFileSync(mobilePkgPath, "utf-8");
    const pkg = JSON.parse(originalPkg);
    const originalPkgName = pkg.name;
    pkg.name = wtName;
    writeFileSync(mobilePkgPath, JSON.stringify(pkg, null, 2) + "\n");

    const appJsonPath = resolve(mobileDir, "app.json");
    const originalAppJson = readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(originalAppJson);
    appJson.expo.name = wtName;
    writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

    console.log(`📛 mobile name: ${originalPkgName} → ${wtName}`);

    // 恢复函数
    restoreFn = () => {
      writeFileSync(mobilePkgPath, originalPkg);
      writeFileSync(appJsonPath, originalAppJson);
      console.log(`\n📛 mobile name 已恢复: ${originalPkgName}`);
    };

    // 4. 读取 mobile .env 中的 API URL，替换端口
    const mobileEnvPath = resolve(mobileDir, ".env");
    const mobileEnvContent = readFileSync(mobileEnvPath, "utf-8");
    const apiUrlMatch = mobileEnvContent.match(/EXPO_PUBLIC_API_URL=(.+)/);
    const mobileEnv = { ...process.env };
    let hostIp = "0.0.0.0";
    if (apiUrlMatch) {
      const originalUrl = apiUrlMatch[1].trim();
      const newUrl = originalUrl.replace(/:\d+$/, `:${backendPort}`);
      mobileEnv.EXPO_PUBLIC_API_URL = newUrl;
      console.log(`🔗 EXPO_PUBLIC_API_URL → ${newUrl}`);
      const ipMatch = originalUrl.match(/\/\/([^:]+)/);
      if (ipMatch) hostIp = ipMatch[1];
    }

    const CYAN = "\x1b[36m";
    const GREEN = "\x1b[32m";

    // 5. 信号处理（提前定义，供 onExit 回调使用）
    let cleaned = false;
    let backendProc, mobileProc;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try { backendProc?.kill(); } catch {}
      try { mobileProc?.kill(); } catch {}
      if (restoreFn) restoreFn();
    };

    const onChildExit = (code) => {
      if (code !== 0 && code !== null) {
        cleanup();
        process.exit(code);
      }
    };

    backendProc = spawnWithPrefix(
      "uv",
      [
        "run",
        "uvicorn",
        "main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        String(backendPort),
      ],
      { cwd: backendDir, env: { ...process.env, FORCE_COLOR: "1" } },
      "backend",
      CYAN,
      onChildExit
    );

    mobileProc = spawnWithPrefix(
      "pnpm",
      ["--filter", wtName, "dev", "--port", String(frontendPort)],
      { cwd: wtDir, env: { ...mobileEnv, FORCE_COLOR: "1" } },
      "mobile",
      GREEN,
      onChildExit
    );

    console.log(
      `\n🚀 backend → http://${hostIp}:${backendPort}  |  mobile → http://${hostIp}:${frontendPort}\n`
    );

    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });
  } catch (e) {
    console.error(e.message);
    if (restoreFn) restoreFn();
    process.exit(1);
  }
}

// ── 入口 ──────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
