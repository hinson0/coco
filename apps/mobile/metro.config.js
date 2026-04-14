const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 让 Metro 能解析 monorepo 根目录下的 modules/ 和 packages/
config.watchFolders = [monorepoRoot];

// 确保 node_modules 从 monorepo 根目录解析（pnpm hoisting）
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
