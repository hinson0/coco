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
