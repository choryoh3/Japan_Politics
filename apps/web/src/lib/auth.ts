import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { account, session, user, verification } from "@japan-politics/db";
import { headers } from "next/headers";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-constants";
import { getDb } from "@/lib/db";

/** 画面とサーバーで使うログイン中ユーザーの情報。 */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** "admin"（管理者）か "user"（一般ユーザー） */
  role: "admin" | "user";
}

/**
 * Better Auth を作る。
 * ビルド時に環境変数（BETTER_AUTH_SECRET）が無くても読み込みだけで失敗しないよう、
 * 最初に使われたときに作って使い回す。
 * @returns Better Auth のインスタンス
 */
function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    user: {
      additionalFields: {
        // 権限は登録フォームから指定できないようにする（input: false）。登録した人は必ず "user"
        role: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
  });
}

const globalForAuth = globalThis as unknown as { __jpAuth?: ReturnType<typeof createAuth> };

/**
 * アプリ全体で共有する Better Auth を返す。
 * @returns Better Auth のインスタンス
 */
export function getAuth() {
  globalForAuth.__jpAuth ??= createAuth();
  return globalForAuth.__jpAuth;
}

/**
 * セッションのユーザー情報から、画面で使う形（権限は admin / user のどちらか）にそろえる。
 * @param raw Better Auth が返したユーザー
 * @returns 画面用のユーザー
 */
function toCurrentUser(raw: {
  id: string;
  name: string;
  email: string;
  role?: unknown;
}): CurrentUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role === "admin" ? "admin" : "user",
  };
}

/**
 * リクエストのヘッダー（cookie）からログイン中のユーザーを調べる。
 * @param requestHeaders リクエストヘッダー
 * @returns ログイン中のユーザー。未ログインなら null
 */
export async function getUserFromHeaders(requestHeaders: Headers): Promise<CurrentUser | null> {
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  return result ? toCurrentUser(result.user) : null;
}

/**
 * サーバーコンポーネントから、ログイン中のユーザーを調べる。
 * @returns ログイン中のユーザー。未ログインなら null
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getUserFromHeaders(await headers());
}
