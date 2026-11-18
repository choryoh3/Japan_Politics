import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

/**
 * pnpm ワークスペースのルート（pnpm-workspace.yaml があるフォルダ）を探す。
 * @param startDir 探索を始めるフォルダ
 * @returns ルートのパス。見つからなければ startDir
 */
function findWorkspaceRoot(startDir: string): string {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

/**
 * DATABASE_URL を実際に接続できる URL にする。
 * `file:./local.db` のような相対パスは、どのパッケージから実行しても
 * 同じファイルを指すよう、ワークスペースのルート基準に直す。
 * @param url 環境変数 DATABASE_URL の値（未設定なら file:./local.db）
 * @returns libSQL に渡す URL
 */
export function resolveDatabaseUrl(url: string | undefined): string {
  const value = url && url.length > 0 ? url : "file:./local.db";
  if (!value.startsWith("file:")) return value;
  const path = value.slice("file:".length);
  if (path.startsWith("/") || path === ":memory:") return value;
  return `file:${resolve(findWorkspaceRoot(process.cwd()), path)}`;
}

/**
 * DB クライアントを作る。
 * @param url 接続 URL（省略時は環境変数 DATABASE_URL）
 * @returns Drizzle の DB ハンドル
 */
export function createDb(url?: string) {
  const client = createClient({
    url: resolveDatabaseUrl(url ?? process.env.DATABASE_URL),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

/** アプリ全体で使う DB ハンドルの型。 */
export type Db = ReturnType<typeof createDb>;
