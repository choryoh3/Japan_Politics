import type { Context, MiddlewareHandler } from "hono";

/** 読み取り専用のメソッド（状態を変えないので検査しない）。 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 変更系リクエスト（POST / PUT / DELETE など）の送信元を検査するミドルウェアを作る。
 * 他のサイトからログイン中の管理者のブラウザ経由で変更させる攻撃（CSRF）を防ぐ。
 *
 * - Origin ヘッダーがあれば、許可した Origin のときだけ通す（"null" や他サイトは 403）。
 * - Origin が無く、Sec-Fetch-Site が cross-site なら 403。
 * - どちらも無いリクエストは通す。ブラウザは変更系リクエストに必ず Origin を付けるので、
 *   無いのは curl などの非ブラウザで、CSRF の対象にならない（権限の確認は別に API が行う）。
 *
 * Hono 標準の csrf ミドルウェアは JSON の変更系リクエストを検査せず、Content-Type が無い
 * DELETE を「フォーム」とみなして Origin 無しを拒否するので、方針に合わせて自前で書いている。
 * @param isAllowed 許可する Origin かを判定する関数
 * @returns ミドルウェア
 */
export function originGuard(isAllowed: (origin: string, c: Context) => boolean): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const origin = c.req.header("origin");
    const blocked =
      origin !== undefined
        ? !isAllowed(origin, c)
        : c.req.header("sec-fetch-site") === "cross-site";
    if (blocked)
      return c.json({ error: "許可されていない送信元です", code: "forbiddenOrigin" }, 403);
    return next();
  };
}
