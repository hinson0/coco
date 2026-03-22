import {
  existsSync,
  lstatSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ENV_DIR = join(ROOT, ".env");

const ENV_MAPPING = [
  { src: "mobile.env", dest: "apps/mobile/.env" },
  { src: "api.env.local", dest: "apps/api/.env.local" },
];

function sync() {
  for (const { src, dest } of ENV_MAPPING) {
    const srcFile = join(ENV_DIR, src);
    const destFile = join(ROOT, dest);

    if (!existsSync(srcFile)) {
      console.log(`⚠源文件不存在:${srcFile}.跳过，不做任何操作`);
      continue;
    }

    const destDir = dirname(destFile);
    if (!existsSync(destDir)) {
      console.log(`⚠目标文件夹不存在:${destDir}.跳过，不做任何操作`);
      continue;
    }

    // 已经正确的symlink跳过
    if (existsSync(destFile) && lstatSync(destFile).isSymbolicLink()) {
      if (readlinkSync(destFile) === relative(destDir, srcFile)) {
        console.log(`- ${dest}已经正确的symlink.跳过，不做任何操作`);
        continue;
      }
      rmSync(destFile);
    }

    // 已存在普通文件则警告
    if (existsSync(destFile)) {
      console.log(`${dest}是手动文件,跳过(删除后重新运行可创建symlink)`);
      continue;
    }
    symlinkSync(relative(destDir, srcFile), destFile);
    console.log(`✓ ${dest} → .env/${src}`);
  }
}

sync();
