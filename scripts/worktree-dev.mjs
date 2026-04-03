#!/usr/bin/env node
// scripts/worktree-dev.mjs — 启动 worktree 的 dev server（自动安装依赖）

import { execSync } from "child_process";
import { existsSync, lstatSync, readFileSync, symlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

export function parseArgs(argv) {
  const args = argv.slice(2);
  const name = args.find((a) => !a.startsWith("--"));
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
    // 已存在（文件或 symlink）→ 跳过
    if (lstatSync(link, { throwIfNoEntry: false })) {
      continue;
    }
    // target 不可读 → 报错
    if (!existsSync(target)) {
      throw new Error(`找不到 env 文件: ${target}`);
    }
    symlinkSync(target, link);
  }
}

// ── 原有逻辑（暂时保留，Task 3 重写）──
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2];
  if (!name) {
    console.error("用法: pnpm worktree <name>");
    process.exit(1);
  }

  const dir = resolve(".claude/worktrees", name);

  if (!existsSync(dir)) {
    console.error(`❌ worktree 不存在: ${dir}`);
    process.exit(1);
  }

  const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

  // 依赖不存在则自动安装
  if (!existsSync(resolve(dir, "node_modules"))) {
    console.log("📦 首次启动，安装依赖...");
    run("pnpm install", { cwd: dir });
  }

  // 临时修改 package.json name + app.json name，方便多 worktree 调试时区分
  const wtName = `worktree-${name}`;
  const mobileDir = resolve(dir, "apps/mobile");

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

  // dev server 结束后恢复原始文件
  const restore = () => {
    writeFileSync(mobilePkgPath, originalPkg);
    writeFileSync(appJsonPath, originalAppJson);
    console.log(`\n📛 mobile name 已恢复: ${originalPkgName}`);
  };
  process.on("SIGINT", () => {
    restore();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    restore();
    process.exit(0);
  });

  try {
    const extra = process.argv.slice(3).join(" ");
    run(`pnpm --filter ${pkg.name} dev ${extra}`, { cwd: dir });
  } finally {
    restore();
  }
}
