import js from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,cjs,ts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },

  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,cjs,ts,jsx,tsx}"],
    rules: {
      "no-empty": ["warn", { allowEmptyCatch: true }], // try { ... } catch {} 在 RN 中常见（字体加载、权限检查等容错），空 catch 是有意为之
      "@typescript-eslint/no-require-imports": "off", // RN 图片 require("./icon.png") 是框架强制的，不是代码坏味道
      "@typescript-eslint/no-unused-vars": [
        // 函数参数命名 _e 或 _unused/表示"我知道没用但需要占位"，这是社区约定
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // 存量 25 个 any，一次修完不现实，先警告提醒后续清理
    },
  },

  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { react: pluginReact },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },

  // __mocks__
  {
    files: ["__mocks__/**/*.js"],
    languageOptions: { globals: globals.node },
  },
]);
