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
    files: ["**/*.{jsx,tsx}"],
    plugins: { react: pluginReact },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },
]);
