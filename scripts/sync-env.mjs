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
const ENV_DIR = join(ROOT, ".envfiles");

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

    // 清理断开的 symlink（existsSync 对 broken symlink 返回 false，但条目仍存在）
    try {
      if (lstatSync(destFile).isSymbolicLink()) {
        rmSync(destFile);
      } else {
        console.log(`- ${dest} 是手动文件，跳过（删除后重新运行可创建 symlink）`);
        continue;
      }
    } catch {
      // lstatSync 抛 ENOENT 说明真的不存在，继续创建
    }

    symlinkSync(linkTarget, destFile);
    console.log(`✓ ${dest} → .env/${src}`);
  }
}

sync();
