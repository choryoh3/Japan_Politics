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

/** 書式文字（ゼロ幅スペース、ソフトハイフン、文字の向きを変える制御など。見えないが文字として残る）。 */
const FORMAT_CHAR_PATTERN = /\p{Cf}/u;

/**
 * 絵文字の結合に使われる正当な書式文字の並び。
 * - ZWJ（U+200D）は、絵文字どうしの間にあるときだけ許す（家族の絵文字など）。
 * - タグ文字（U+E0020-E007F）は、絵文字の直後だけ許す（イングランドの旗など）。
 * これ以外の位置にある書式文字は「見た目が同じ別人物」を作れるため許さない。
 */
const EMOJI_JOINER_PATTERN =
  /(?<=[\p{Extended_Pictographic}\uFE0F])\u200D(?=\p{Extended_Pictographic})|(?<=[\p{Extended_Pictographic}\u{E0020}-\u{E007F}])[\u{E0020}-\u{E007F}]/gu;

/**
 * 絵文字の正当な結合を除いたうえで、書式文字が残っていないかを調べる。
 * @param value 文字列
 * @returns 不正な書式文字がなければ true
 */
function hasNoInvisibleFormatChar(value: string): boolean {
  return !FORMAT_CHAR_PATTERN.test(value.replace(EMOJI_JOINER_PATTERN, ""));
}

/**
 * 見える文字（書式文字と空白を除いて残る文字）が1つ以上あるかを調べる。
 * @param value 文字列
 * @returns 見える文字があれば true
 */
function hasVisibleChar(value: string): boolean {
  return value.replace(/[\p{Cf}\s]/gu, "").length > 0;
}

/**
 * メモに使えない制御文字（改行とタブ以外）を含まないかを調べる。
 * @param value 文字列
 * @returns 禁止文字がなければ true
 */
function hasNoForbiddenMemoChar(value: string): boolean {
  const withoutAllowed = value.replace(/[\n\r\t]/g, "");
  return !CONTROL_CHAR_PATTERN.test(withoutAllowed) && hasNoInvisibleFormatChar(withoutAllowed);
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
    // 見えない文字だけの氏名は「未入力」と同じ扱いにする
    .refine(hasVisibleChar, { error: "nameRequired" })
    .max(PERSON_NAME_MAX_LENGTH, { error: "nameTooLong" })
    .refine(hasNoControlChar, { error: "nameInvalidChar" })
    .refine(hasNoInvisibleFormatChar, { error: "nameInvalidChar" }),
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
