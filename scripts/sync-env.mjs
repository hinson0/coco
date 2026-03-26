#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ENV_DIR = join(ROOT, ".env");

const WORKTREE_NAME = process.argv[2];

let worktreeDir;
if (!WORKTREE_NAME) {
  worktreeDir = ROOT;
} else {
  worktreeDir = resolve(ROOT, ".claude/worktrees", WORKTREE_NAME);
}

if (!existsSync(worktreeDir)) {
  console.error(`⚠ 工作树目录不存在: ${worktreeDir}`);
  process.exit(1);
}

// 映射：.env/ 下的源文件 → destDir 下的相对目标路径
const ENV_MAPPING = [
  { src: "mobile.env", dest: "apps/mobile/.env" },
  { src: "api.env.local", dest: "apps/api/.env.local" },
];

function sync() {
  for (const { src, dest } of ENV_MAPPING) {
    const srcFile = join(ENV_DIR, src);
    const destFile = join(worktreeDir, dest);

    if (!existsSync(srcFile)) {
      console.log(`⚠ 源文件不存在: ${srcFile}，跳过`);
      continue;
    }

    // 计算 destFile 相对于其所在目录到 srcFile 的相对路径
    const linkTarget = relative(dirname(destFile), srcFile);

    // 已经正确的 symlink 则跳过
    if (existsSync(destFile) && lstatSync(destFile).isSymbolicLink()) {
      if (readlinkSync(destFile) === linkTarget) {
        console.log(`- ${dest} 已是正确的 symlink，跳过`);
        continue;
      }
      rmSync(destFile);
    }

    // 检查worktree中是否有该package目录
    const destDir = dirname(destFile);
    if (!existsSync(destDir)) {
      console.log(`- ${destDir}不存在,因此无需创建symlink.`);
      continue;
    }

    // 已存在普通文件则警告
    if (existsSync(destFile)) {
      console.log(`- ${dest} 是手动文件，跳过（删除后重新运行可创建 symlink）`);
      continue;
    }

    symlinkSync(linkTarget, destFile);
    console.log(`✓ ${dest} → .env/${src}`);
  }
}

sync();
