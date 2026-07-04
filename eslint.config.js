import js from "@eslint/js";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";

export default [
  { ignores: ["dist/**", "public/**", "db/leads-db.json", "node_modules/**"] },
  js.configs.recommended,
  {
    files: [
      "api/**/*.{js,mjs}",
      "config/**/*.{js,mjs}",
      "core/**/*.{js,mjs}",
      "db/**/*.{js,mjs}",
      "scripts/**/*.{js,mjs}",
      "server.js",
      "vite.config.js",
      "eslint.config.js",
    ],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["apps/web/**/*.js", "apps/admin/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["warn", "smart"],
      "no-console": "off",
    },
  },
  prettierConfig,
];
