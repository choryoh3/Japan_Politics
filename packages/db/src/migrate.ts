import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "./client.ts";

/** マイグレーション SQL のフォルダ（packages/db/drizzle） */
export const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * 未適用のマイグレーションを DB に適用する。何度実行しても安全。
 * @param db DB ハンドル
 */
export async function runMigrations(db: ReturnType<typeof createDb>): Promise<void> {
  await migrate(db, { migrationsFolder });
}

// コマンド（pnpm db:migrate）として直接実行されたときだけ動かす
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runMigrations(createDb());
  console.log("マイグレーションを適用しました");
}
