import { createDb, type Db } from "@japan-politics/db";

/** 開発中のホットリロードで接続が増え続けないよう、ひとつだけ使い回す。 */
const globalForDb = globalThis as unknown as { __jpDb?: Db };

/**
 * アプリ全体で共有する DB ハンドルを返す。
 * @returns DB ハンドル
 */
export function getDb(): Db {
  globalForDb.__jpDb ??= createDb();
  return globalForDb.__jpDb;
}
