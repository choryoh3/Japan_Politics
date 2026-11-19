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
 * 「見えない文字」の定義。Unicode の標準の性質 Default_Ignorable_Code_Point
 * （ゼロ幅スペース、ソフトハイフン、向きの制御、異体字セレクタ、ハングル・フィラー U+3164 など、
 * 画面に何も描かれない文字の一括りの分類）に、点字の空白 U+2800 を足したもの。
 * 文字を1つずつ列挙すると取りこぼすため、標準の分類で網羅する。
 */
const INVISIBLE_CHAR_PATTERN = /[\p{Default_Ignorable_Code_Point}\u2800]/u;

/**
 * 絵文字の正当な並び（Unicode の RGI_Emoji）。
 * 肌の色付き（👩🏽‍💻）・家族（👨‍👩‍👧）・旗（🇯🇵、イングランドの旗）・🏳️‍🌈・❤️ などが入る。
 * これらの内側にある ZWJ・異体字セレクタ・タグ文字は「見えない文字」だが正当なので、
 * 検査の前に取り除く。意味のない並び（😀+ZWJ+😀、😀+タグ文字）は RGI に含まれず、取り除かれずに残る。
 * 「v」フラグ（文字列のプロパティ）が必要なため、RegExp の文字列で組み立てる。
 */
const RGI_EMOJI_PATTERN = new RegExp("\\p{RGI_Emoji}", "gv");

/**
 * 見えない文字を含まないかを調べる。正当な絵文字の中にあるものだけは例外として許す。
 * @param value 文字列
 * @returns 不正な見えない文字がなければ true
 */
function hasNoInvisibleChar(value: string): boolean {
  return !INVISIBLE_CHAR_PATTERN.test(value.replace(RGI_EMOJI_PATTERN, ""));
}

/**
 * 見える文字が1つ以上あるかを調べる。
 * 見えない文字・空白・結合文字（濁点や異体字だけが単独で残る並び）を除いて、1文字以上残れば true。
 * @param value 文字列
 * @returns 見える文字があれば true
 */
function hasVisibleChar(value: string): boolean {
  const withoutEmojiJoiners = value.replace(RGI_EMOJI_PATTERN, "\u{1F600}");
  return (
    withoutEmojiJoiners.replace(/[\p{Default_Ignorable_Code_Point}\u2800\s\p{M}]/gu, "").length > 0
  );
}

/**
 * 氏名を NFC に正規化する。「か＋濁点」と「が」のような見た目が同じ別表現を同じ文字列にそろえ、
 * 重複チェックをすり抜けられないようにする。
 * @param value 入力値
 * @returns 文字列なら正規化した文字列、それ以外はそのまま（型の検証は後段で行う）
 */
function normalizeName(value: unknown): unknown {
  return typeof value === "string" ? value.normalize("NFC") : value;
}

/**
 * メモに使えない文字（改行とタブ以外の制御文字、不正な見えない文字）を含まないかを調べる。
 * @param value 文字列
 * @returns 禁止文字がなければ true
 */
function hasNoForbiddenMemoChar(value: string): boolean {
  const withoutAllowed = value.replace(/[\n\r\t]/g, "");
  return !CONTROL_CHAR_PATTERN.test(withoutAllowed) && hasNoInvisibleChar(withoutAllowed);
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
  name: z.preprocess(
    normalizeName,
    z
      .string({ error: "nameRequired" })
      .trim()
      .min(1, { error: "nameRequired" })
      // 見えない文字だけの氏名は「未入力」と同じ扱いにする
      .refine(hasVisibleChar, { error: "nameRequired" })
      .max(PERSON_NAME_MAX_LENGTH, { error: "nameTooLong" })
      .refine(hasNoControlChar, { error: "nameInvalidChar" })
      .refine(hasNoInvisibleChar, { error: "nameInvalidChar" }),
  ),
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
