import { fileURLToPath } from "node:url";
import { createDb } from "./client.ts";
import { grantAdmin } from "./person-write.ts";

/**
 * 管理者付与コマンドの本体。
 * @param email 管理者にするアカウントのメールアドレス
 * @returns 終了コード（0 は成功、1 は引数なし、2 は該当アカウントなし）
 */
export async function runGrantAdmin(email: string | undefined): Promise<number> {
  if (!email) {
    console.error("使い方: pnpm admin:grant <メールアドレス>");
    return 1;
  }
  const result = await grantAdmin(createDb(), email);
  if (!result.ok) {
    console.error("該当するアカウントがありません");
    return 2;
  }
  console.log(`${email} を管理者にしました`);
  return 0;
}

// コマンド（pnpm admin:grant）として直接実行されたときだけ動かす
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runGrantAdmin(process.argv[2]);
}
