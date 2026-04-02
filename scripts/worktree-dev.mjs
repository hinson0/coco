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
