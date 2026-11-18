import { z } from "zod";

/** よみがなに使える文字（ひらがなと長音符「ー」）。 */
const HIRAGANA_PATTERN = /^[ぁ-ゖゝゞー]+$/;

/** 制御文字（NUL・改行・タブ・BEL など）。氏名とよみがなでは一切許さない。 */
const CONTROL_CHAR_PATTERN = /\p{Cc}/u;

/**
 * 制御文字を含まないかを調べる。NUL は DB 内で文字列が途切れ、重複チェックをすり抜けるため拒否する。
 * @param value 文字列
 * @returns 制御文字がなければ true
 */
function hasNoControlChar(value: string): boolean {
  return !CONTROL_CHAR_PATTERN.test(value);
}

/**
 * メモに使えない制御文字（改行とタブ以外）を含まないかを調べる。
 * @param value 文字列
 * @returns 禁止文字がなければ true
 */
function hasNoForbiddenMemoChar(value: string): boolean {
  const withoutAllowed = value.replace(/[\n\r\t]/g, "");
  return !CONTROL_CHAR_PATTERN.test(withoutAllowed);
}

/** 氏名の最大文字数。 */
export const PERSON_NAME_MAX_LENGTH = 50;
/** よみがなの最大文字数。 */
export const PERSON_KANA_MAX_LENGTH = 100;
/** メモの最大文字数。 */
export const PERSON_MEMO_MAX_LENGTH = 1000;

/**
 * 「YYYY-MM-DD」が実在する日付かを調べる（例: 2月30日は不正）。
 * @param value 日付文字列
 * @returns 実在する日付なら true
 */
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 空文字を「入力なし」(null) にそろえる。フォームの空欄を任意項目として扱うため。
 * @param value 入力値
 * @returns 空なら null、それ以外はそのまま
 */
function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

/**
 * 人物の入力の検証ルール。エラーメッセージは文言ではなくエラーコードで、
 * 画面側が辞書（next-intl）で日本語にする。
 */
export const personInputSchema = z.object({
  name: z
    .string({ error: "nameRequired" })
    .trim()
    .min(1, { error: "nameRequired" })
    .max(PERSON_NAME_MAX_LENGTH, { error: "nameTooLong" })
    .refine(hasNoControlChar, { error: "nameInvalidChar" }),
  kana: z
    .string({ error: "kanaRequired" })
    .trim()
    .min(1, { error: "kanaRequired" })
    .max(PERSON_KANA_MAX_LENGTH, { error: "kanaTooLong" })
    .refine(hasNoControlChar, { error: "kanaInvalidChar" })
    .regex(HIRAGANA_PATTERN, { error: "kanaNotHiragana" }),
  birthDate: z.preprocess(
    emptyToNull,
    z
      .string({ error: "birthDateInvalid" })
      .trim()
      .refine(isRealDate, { error: "birthDateInvalid" })
      .nullable(),
  ),
  memo: z.preprocess(
    emptyToNull,
    z
      .string({ error: "memoTooLong" })
      .trim()
      .max(PERSON_MEMO_MAX_LENGTH, { error: "memoTooLong" })
      .refine(hasNoForbiddenMemoChar, { error: "memoInvalidChar" })
      .nullable(),
  ),
});

/** 検証済みの人物入力。 */
export type PersonInput = z.infer<typeof personInputSchema>;

/** 項目ごとのエラーコード。 */
export type PersonInputErrors = Partial<Record<keyof PersonInput, string>>;

/**
 * 人物の入力を検証する。
 * @param raw 外部から来た入力（形式は問わない）
 * @returns 成功なら検証済みの値、失敗なら項目ごとのエラーコード
 */
export function validatePersonInput(
  raw: unknown,
): { ok: true; value: PersonInput } | { ok: false; errors: PersonInputErrors } {
  const result = personInputSchema.safeParse(raw ?? {});
  if (result.success) return { ok: true, value: result.data };
  const errors: PersonInputErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      (field === "name" || field === "kana" || field === "birthDate" || field === "memo") &&
      !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}
