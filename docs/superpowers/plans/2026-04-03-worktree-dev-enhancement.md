# Worktree Dev 脚本增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 `scripts/worktree-dev.mjs`，实现一个命令搞定 worktree 的 env 配置、依赖安装和前后端并发启动。

**Architecture:** 在现有脚本中提取可测试的纯函数（`parseArgs`、`ensureEnvSymlinks`），其余编排逻辑（依赖安装、进程管理）保持命令式。通过 `import.meta.url` 守卫实现同一文件既是脚本又可被测试导入。

**Tech Stack:** Node.js（`child_process.spawn`）、`node:test` + `node:assert`（测试）、无新依赖

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `scripts/worktree-dev.mjs` | 修改 — 全量重写，新增 env symlink、uv sync、并发启动 |
| `scripts/__tests__/worktree-dev.test.mjs` | 新建 — parseArgs 和 ensureEnvSymlinks 单元测试 |
| `package.json` | 修改 — 新增 `test:scripts` 命令 |

---

### Task 1: parseArgs TDD

**Files:**
- Create: `scripts/__tests__/worktree-dev.test.mjs`
- Modify: `scripts/worktree-dev.mjs`
- Modify: `package.json`

- [ ] **Step 1: 在 package.json 添加测试命令**

在 `scripts` 字段中添加：

```json
"test:scripts": "node --test scripts/__tests__/*.test.mjs"
```

完整的 `scripts` 字段变为：

```json
"scripts": {
  "dev": "pnpm --filter mobile dev",
  "worktree": "node scripts/worktree-dev.mjs",
  "test": "pnpm --filter mobile test",
  "test:scripts": "node --test scripts/__tests__/*.test.mjs"
}
```

- [ ] **Step 2: 写失败测试**

创建 `scripts/__tests__/worktree-dev.test.mjs`：

```js
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parseArgs } from "../worktree-dev.mjs";

describe("parseArgs", () => {
  it("解析 name + 默认端口", () => {
    const result = parseArgs(["node", "script.mjs", "feat-infra"]);
    assert.deepStrictEqual(result, {
      name: "feat-infra",
      backendPort: 8000,
      frontendPort: 8080,
    });
  });

  it("解析 --port 参数", () => {
    const result = parseArgs([
      "node",
      "script.mjs",
      "feat-infra",
      "--port",
      "8001",
    ]);
    assert.deepStrictEqual(result, {
      name: "feat-infra",
      backendPort: 8001,
      frontendPort: 8081,
    });
  });

  it("缺少 name 时抛出错误", () => {
    assert.throws(() => parseArgs(["node", "script.mjs"]), /用法/);
  });

  it("--port 非数字时抛出错误", () => {
    assert.throws(
      () => parseArgs(["node", "script.mjs", "feat", "--port", "abc"]),
      /数字/
    );
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `pnpm test:scripts`
Expected: FAIL — `parseArgs` 尚未导出

- [ ] **Step 4: 实现 parseArgs**

在 `scripts/worktree-dev.mjs` 顶部添加（保留现有代码不动，后续 Task 再重写）：

```js
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
```

同时用 `import.meta.url` 守卫包裹现有的主逻辑，防止测试导入时执行：

```js
import { fileURLToPath } from "url";

// ... parseArgs 定义 ...

// ── 原有逻辑（暂时保留，Task 3 重写）──
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 把原来的所有顶层执行代码放进这个 if 块
  const name = process.argv[2];
  // ... 现有代码 ...
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `pnpm test:scripts`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/__tests__/worktree-dev.test.mjs scripts/worktree-dev.mjs package.json
git commit -m "feat(scripts): 添加 parseArgs 函数及单元测试"
```

---

### Task 2: ensureEnvSymlinks TDD

**Files:**
- Modify: `scripts/__tests__/worktree-dev.test.mjs`
- Modify: `scripts/worktree-dev.mjs`

- [ ] **Step 1: 写失败测试**

在 `scripts/__tests__/worktree-dev.test.mjs` 末尾追加：

```js
import { beforeEach, afterEach } from "node:test";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureEnvSymlinks } from "../worktree-dev.mjs";

describe("ensureEnvSymlinks", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "wt-test-"));
    mkdirSync(join(tmpDir, "main/apps/backend"), { recursive: true });
    mkdirSync(join(tmpDir, "main/apps/mobile"), { recursive: true });
    mkdirSync(join(tmpDir, "wt/apps/backend"), { recursive: true });
    mkdirSync(join(tmpDir, "wt/apps/mobile"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("target 存在时创建 symlink", () => {
    const mainDir = join(tmpDir, "main");
    const wtDir = join(tmpDir, "wt");
    writeFileSync(join(mainDir, "apps/backend/.env"), "KEY=val");
    writeFileSync(join(mainDir, "apps/mobile/.env"), "KEY=val");

    ensureEnvSymlinks(mainDir, wtDir);

    assert.equal(
      readlinkSync(join(wtDir, "apps/backend/.env")),
      join(mainDir, "apps/backend/.env")
    );
    assert.equal(
      readlinkSync(join(wtDir, "apps/mobile/.env")),
      join(mainDir, "apps/mobile/.env")
    );
  });

  it("symlink 已存在时跳过（幂等）", () => {
    const mainDir = join(tmpDir, "main");
    const wtDir = join(tmpDir, "wt");
    writeFileSync(join(mainDir, "apps/backend/.env"), "KEY=val");
    writeFileSync(join(mainDir, "apps/mobile/.env"), "KEY=val");

    ensureEnvSymlinks(mainDir, wtDir);
    ensureEnvSymlinks(mainDir, wtDir); // 第二次不报错

    assert.ok(existsSync(join(wtDir, "apps/backend/.env")));
  });

  it("已有真实文件时跳过（不覆盖手动 copy）", () => {
    const mainDir = join(tmpDir, "main");
    const wtDir = join(tmpDir, "wt");
    writeFileSync(join(mainDir, "apps/backend/.env"), "MAIN=val");
    writeFileSync(join(mainDir, "apps/mobile/.env"), "MAIN=val");
    writeFileSync(join(wtDir, "apps/backend/.env"), "LOCAL=val");
    writeFileSync(join(wtDir, "apps/mobile/.env"), "LOCAL=val");

    ensureEnvSymlinks(mainDir, wtDir); // 不报错，不覆盖

    // 仍然是原始文件内容，不是 symlink
    const content = readFileSync(join(wtDir, "apps/backend/.env"), "utf-8");
    assert.equal(content, "LOCAL=val");
  });

  it("target 不存在时抛出错误", () => {
    const mainDir = join(tmpDir, "main");
    const wtDir = join(tmpDir, "wt");

    assert.throws(() => ensureEnvSymlinks(mainDir, wtDir), /找不到 env 文件/);
  });
});
```

注意：顶部 import 需要合并。完整的 import 区域为：

```js
import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readlinkSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs, ensureEnvSymlinks } from "../worktree-dev.mjs";
```

- [ ] **Step 2: 运行测试，确认新测试失败**

Run: `pnpm test:scripts`
Expected: parseArgs 4 PASS，ensureEnvSymlinks 4 FAIL（函数未导出）

- [ ] **Step 3: 实现 ensureEnvSymlinks**

在 `scripts/worktree-dev.mjs` 中添加：

```js
import { existsSync, lstatSync, symlinkSync } from "fs";
import { resolve } from "path";

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
    // target 不可读 → 报错退出
    if (!existsSync(target)) {
      throw new Error(`找不到 env 文件: ${target}`);
    }
    symlinkSync(target, link);
  }
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

Run: `pnpm test:scripts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/__tests__/worktree-dev.test.mjs scripts/worktree-dev.mjs
git commit -m "feat(scripts): 添加 ensureEnvSymlinks 函数及单元测试"
```

---

### Task 3: 重写主脚本逻辑

**Files:**
- Modify: `scripts/worktree-dev.mjs`

- [ ] **Step 1: 全量重写 `scripts/worktree-dev.mjs`**

```js
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

function spawnWithPrefix(cmd, args, opts, prefix, colorCode) {
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

    // 4. 并发启动
    console.log(
      `\n🚀 backend → http://0.0.0.0:${backendPort}  |  mobile → port ${frontendPort}\n`
    );

    const CYAN = "\x1b[36m";
    const GREEN = "\x1b[32m";

    const backendProc = spawnWithPrefix(
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
      { cwd: backendDir },
      "backend",
      CYAN
    );

    const mobileProc = spawnWithPrefix(
      "pnpm",
      ["--filter", wtName, "dev", "--port", String(frontendPort)],
      { cwd: wtDir },
      "mobile",
      GREEN
    );

    // 5. 信号处理
    const cleanup = () => {
      backendProc.kill();
      mobileProc.kill();
      restoreFn();
    };

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
```

- [ ] **Step 2: 运行单元测试，确认未破坏**

Run: `pnpm test:scripts`
Expected: 8 tests PASS（parseArgs 4 + ensureEnvSymlinks 4）

- [ ] **Step 3: Commit**

```bash
git add scripts/worktree-dev.mjs
git commit -m "feat(scripts): 重写 worktree-dev，支持 env symlink + uv sync + 并发启动"
```

---

### Task 4: 集成验证

- [ ] **Step 1: 回到 main repo 根目录，运行脚本**

```bash
cd /Users/a114514/coco
pnpm worktree feat-infra --port 8000
```

- [ ] **Step 2: 验证 env symlinks**

在另一个终端：
```bash
ls -la /Users/a114514/coco/.claude/worktrees/feat-infra/apps/backend/.env
ls -la /Users/a114514/coco/.claude/worktrees/feat-infra/apps/mobile/.env
```

Expected: 两个都是指向 main repo 的 symlink

- [ ] **Step 3: 验证并发输出**

Expected: 终端显示 `[backend]` 青色前缀 + `[mobile]` 绿色前缀的交错输出

- [ ] **Step 4: 验证 Ctrl+C 退出**

按 Ctrl+C，Expected:
- 两个进程均停止
- 打印 "mobile name 已恢复: mobile"
- `apps/mobile/package.json` 和 `app.json` 恢复原始内容

- [ ] **Step 5: Final commit（如有修复）**

```bash
git add -A
git commit -m "fix(scripts): 集成测试修复"
```
