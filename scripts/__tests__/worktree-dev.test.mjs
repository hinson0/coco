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

    const content = readFileSync(join(wtDir, "apps/backend/.env"), "utf-8");
    assert.equal(content, "LOCAL=val");
  });

  it("target 不存在时抛出错误", () => {
    const mainDir = join(tmpDir, "main");
    const wtDir = join(tmpDir, "wt");

    assert.throws(() => ensureEnvSymlinks(mainDir, wtDir), /找不到 env 文件/);
  });
});
