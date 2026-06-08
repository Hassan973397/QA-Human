// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "examples/**/qa/**",
      // example sample-app sources are illustrative fixtures, not linted code
      "examples/**/src/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // The codebase favors `unknown` but uses a few deliberate `any`s; allow them.
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars are surfaced as warnings, not hard errors (mirrors tsconfig).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Intentional empty catch blocks (best-effort cleanup) are allowed.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Config + scenario template files run in mixed environments.
    files: ["**/*.config.{js,ts}", "**/templates.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
