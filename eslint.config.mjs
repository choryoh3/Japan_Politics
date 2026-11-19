import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const config = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/drizzle/**",
      "**/next-env.d.ts",
      "docs/**",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  {
    settings: { next: { rootDir: "apps/web" } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
  prettier,
];
export default config;
