/** 項目ごとのエラー（辞書のキー）。form は項目に結びつかないエラー。 */
export type FormErrors = Record<string, string>;

/**
 * 保存 API の失敗応答を、画面に出すエラー（辞書のキー）にする。
 * @param status HTTP ステータス
 * @param body 応答の本文（JSON でなければ undefined）
 * @param fieldNames 画面にある項目名（これ以外の項目のエラーは form にまとめる）
 * @returns 項目ごとのエラー
 */
export function errorsFromResponse(
  status: number,
  body: unknown,
  fieldNames: readonly string[],
): FormErrors {
  if (status === 401) return { form: "unauthorized" };
  if (status === 403) return { form: "forbidden" };
  if (status === 404) return { form: "notFound" };
  const fields =
    typeof body === "object" && body !== null && "fields" in body
      ? (body as { fields?: unknown }).fields
      : undefined;
  if (typeof fields === "object" && fields !== null) {
    const result: FormErrors = {};
    for (const key of fieldNames) {
      const value = (fields as Record<string, unknown>)[key];
      if (typeof value === "string") result[key] = value;
    }
    if (Object.keys(result).length > 0) return result;
  }
  return { form: "unknown" };
}
