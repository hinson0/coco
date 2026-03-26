#!/usr/bin/env node
// scripts/worktree-dev.mjs — 启动 worktree 的 dev server（自动安装依赖）

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

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

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "inherit", ...opts });

// 先同步 .env 文件到 worktree
run(`node scripts/sync-env.mjs ${name}`);

// 依赖不存在则自动安装
if (!existsSync(resolve(dir, "node_modules"))) {
  console.log("📦 首次启动，安装依赖...");
  run("pnpm install", { cwd: dir });
}

// 临时修改 mobile 的 package name，方便多 worktree 调试时区分
const mobilePkgPath = resolve(dir, "apps/mobile/package.json");
const originalPkg = readFileSync(mobilePkgPath, "utf-8");
const pkg = JSON.parse(originalPkg);
const originalName = pkg.name;
pkg.name = `worktree-${name}`;
writeFileSync(mobilePkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`📛 mobile name: ${originalName} → ${pkg.name}`);

// dev server 结束后恢复原始 name
const restore = () => {
  writeFileSync(mobilePkgPath, originalPkg);
  console.log(`\n📛 mobile name 已恢复: ${originalName}`);
};
process.on("SIGINT", () => { restore(); process.exit(0); });
process.on("SIGTERM", () => { restore(); process.exit(0); });

try {
  const extra = process.argv.slice(3).join(" ");
  run(`pnpm --filter ${pkg.name} dev ${extra}`, { cwd: dir });
} finally {
  restore();
}
