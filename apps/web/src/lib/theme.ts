/**
 * 配色の選択を保存する localStorage のキーと cookie の名前。
 * サーバー側の layout とクライアント側のボタンの両方が使うため、
 * "use client" ではない独立したファイルに置く。
 */
export const THEME_STORAGE_KEY = "jp-theme";

/** 配色の選択を保存する cookie の名前。サーバーが最初の HTML から配色を決めるために使う。 */
export const THEME_COOKIE_NAME = "jp-theme";

/** 配色の cookie を保つ秒数（1年）。 */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 明示的に選べる配色。 */
export type ThemeChoice = "light" | "dark";

/**
 * 保存されていた文字列が正しい配色かを確かめる。外部（cookie / localStorage）由来の値なので検証する。
 * @param value 保存されていた値（無ければ undefined / null）
 * @returns "light" か "dark"。それ以外は undefined（OS の設定に従う）
 */
export function parseTheme(value: string | null | undefined): ThemeChoice | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}
