import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit（マイグレーション SQL の生成）の設定。
 * 生成だけに使うので DB 接続情報は不要。適用は `src/migrate.ts` が行う。
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
