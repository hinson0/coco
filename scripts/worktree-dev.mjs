#!/usr/bin/env node
// scripts/worktree-dev.mjs — 启动 worktree 的 dev server（自动安装依赖）

import { existsSync } from "fs";
import { execSync } from "child_process";
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

const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: dir });

// 依赖不存在则自动安装
if (!existsSync(resolve(dir, "node_modules"))) {
  console.log("📦 首次启动，安装依赖...");
  run("pnpm install");
}

// 剩余参数透传给 dev
const extra = process.argv.slice(3).join(" ");
run(`pnpm run dev ${extra}`);
