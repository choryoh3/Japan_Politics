import { z } from "zod";

/** よみがなに使える文字（ひらがなと長音符「ー」）。 */
const HIRAGANA_PATTERN = /^[ぁ-ゖゝゞー]+$/;

/** 制御文字（NUL・改行・タブ・BEL など）。よみがなでは一切許さない。 */
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
 * 絵文字の正当な並び（Unicode の RGI_Emoji）。
 * 肌の色付き（👩🏽‍💻）・家族（👨‍👩‍👧）・旗（🇯🇵、イングランドの旗）・🏳️‍🌈・❤️ などが入る。
 * これらの内側にある ZWJ・異体字セレクタ・タグ文字は「見えない文字」だが正当。
 * 意味のない並び（😀+ZWJ+😀、😀+タグ文字）は RGI に含まれない。
 * 「v」フラグ（文字列のプロパティ）が必要なため、RegExp の文字列で組み立てる。
 * 先頭一致（y）は、文字列の途中の位置から1つずつ切り出すために使う。
 */
const RGI_EMOJI_STICKY = new RegExp("\\p{RGI_Emoji}", "vy");
/** 文字列の中の RGI 絵文字をすべて探す版。 */
const RGI_EMOJI_GLOBAL = new RegExp("\\p{RGI_Emoji}", "gv");

/** 画面に何も描かれない文字の標準の分類（ハングル・フィラー、ゼロ幅、異体字セレクタなど）。 */
const DEFAULT_IGNORABLE_PATTERN = /^\p{Default_Ignorable_Code_Point}$/u;
/** 文字（漢字・かな・長音符・ラテン文字など。\p{Lm} を含む）。 */
const LETTER_PATTERN = /^\p{L}$/u;
/** 数字。 */
const NUMBER_PATTERN = /^\p{N}$/u;
/** 結合文字。 */
const MARK_PATTERN = /^\p{M}$/u;

/**
 * 区切りとして許す記号。中黒「・」、中点、ハイフン、アポストロフィ（2種）、ピリオド。
 * 例: 山田・太郎、O'Brien、Jean-Luc、J. Smith
 */
const ALLOWED_SEPARATORS = new Set(["\u30FB", "\u00B7", "-", "'", "\u2019", "."]);

/**
 * NFC 後も単独で残る濁点・半濁点（合成できなかったもの）。
 * 見た目が別の文字と紛らわしい重複を作れるため拒否する。
 */
const STANDALONE_KANA_MARKS = new Set(["\u3099", "\u309A"]);

/** 氏名を構成する要素の種類。 */
type NameElementKind = "visible" | "mark" | "separator" | "space" | "invalid";

/** 氏名の1要素（絵文字1つ、または1コードポイント）。 */
interface NameElement {
  /** 要素の文字列。 */
  text: string;
  /** 種類。visible は文字・数字・絵文字（実際に見える要素）。 */
  kind: NameElementKind;
  /** 絵文字かどうか。 */
  isEmoji: boolean;
}

/**
 * コードポイント1文字の種類を判定する。
 * @param char 1コードポイントの文字
 * @returns 種類
 */
function classifyChar(char: string): NameElementKind {
  if (char === " " || char === "\u3000") return "space";
  if (ALLOWED_SEPARATORS.has(char)) return "separator";
  if (DEFAULT_IGNORABLE_PATTERN.test(char)) return "invalid";
  if (LETTER_PATTERN.test(char) || NUMBER_PATTERN.test(char)) return "visible";
  if (MARK_PATTERN.test(char) && !STANDALONE_KANA_MARKS.has(char)) return "mark";
  return "invalid";
}

/**
 * 氏名を要素に分ける。先に RGI 絵文字を1要素として切り出し、残りは1コードポイントずつ分類する。
 * @param name 氏名
 * @returns 要素の並び
 */
function splitNameElements(name: string): NameElement[] {
  const elements: NameElement[] = [];
  let index = 0;
  while (index < name.length) {
    RGI_EMOJI_STICKY.lastIndex = index;
    const emoji = RGI_EMOJI_STICKY.exec(name);
    if (emoji) {
      elements.push({ text: emoji[0], kind: "visible", isEmoji: true });
      index += emoji[0].length;
      continue;
    }
    const char = String.fromCodePoint(name.codePointAt(index) ?? 0);
    elements.push({ text: char, kind: classifyChar(char), isEmoji: false });
    index += char.length;
  }
  return elements;
}

/**
 * 氏名に見える要素（文字・数字・絵文字）が1つ以上あるかを調べる。
 * 記号・空白・結合文字だけの氏名は「未入力」と同じ扱いにするために使う。
 * @param value 氏名
 * @returns 見える要素があれば true
 */
export function hasVisibleChar(value: string): boolean {
  return splitNameElements(value).some((element) => element.kind === "visible");
}

/** 氏名・内閣名の許可リストの設定。 */
export interface AllowedTextOptions {
  /** 絵文字を許すか（氏名は許す。内閣名は許さない） */
  allowEmoji: boolean;
  /** 許す区切り記号 */
  separators: ReadonlySet<string>;
}

/** 氏名の許可設定（絵文字あり、区切りは ALLOWED_SEPARATORS）。 */
const PERSON_NAME_OPTIONS: AllowedTextOptions = {
  allowEmoji: true,
  separators: ALLOWED_SEPARATORS,
};

/**
 * 文字列が「許可する要素」だけでできているかを調べる。
 *
 * 許可するもの: 文字（\p{L}）、数字（\p{N}）、RGI 絵文字（設定で許す場合のみ）、設定で許した区切り記号、
 * 半角スペースと全角スペース、直前が文字か数字の結合文字。
 * それ以外（見えない文字、他の記号、他の空白、改行・タブ、先頭や記号の直後の結合文字、異体字セレクタ）は拒否する。
 *
 * なぜ許可リストか: 「見えない文字」「同じ見た目になる文字」は Unicode に際限なくあり、
 * 拒否する文字を列挙する方式では取りこぼしが続くため、使ってよい種類だけを定義する。
 * 例: 「安倍（全角スペース）晋三」「O'Brien」「👩🏽‍💻」は ok。「評価\u00A0空白」「評価\uFFF9」「\u0301評価」は拒否。
 * @param value 文字列（NFC・空白の畳み込み後）
 * @param options 許可設定（省略すると氏名用）
 * @returns 許可する要素だけなら true
 */
export function hasOnlyAllowedNameChars(
  value: string,
  options: AllowedTextOptions = PERSON_NAME_OPTIONS,
): boolean {
  let previous: NameElement | null = null;
  for (const element of splitNameElements(value)) {
    if (element.kind === "invalid") return false;
    if (element.isEmoji && !options.allowEmoji) return false;
    if (element.kind === "separator" && !options.separators.has(element.text)) return false;
    // 結合文字は、文字・数字（またはその結合文字）の直後だけ。絵文字や記号・空白の後ろは重複の元になる
    if (element.kind === "mark") {
      const followsBase =
        previous !== null &&
        (previous.kind === "mark" || (previous.kind === "visible" && !previous.isEmoji));
      if (!followsBase) return false;
    }
    previous = element;
  }
  return true;
}

/**
 * 氏名を NFC に正規化し、連続する半角スペースを1つに畳む。
 * 「か＋濁点」と「が」、「評価 空白」と「評価  空白」のように見た目が同じ別表現を同じ文字列にそろえ、
 * 重複チェックをすり抜けられないようにする。全角スペースは幅が広く見た目が違うので畳まない。
 * @param value 入力値
 * @returns 文字列なら正規化した文字列、それ以外はそのまま（型の検証は後段で行う）
 */
export function normalizeName(value: unknown): unknown {
  return typeof value === "string" ? value.normalize("NFC").replace(/ {2,}/g, " ") : value;
}

/**
 * メモの禁止文字（拒否リスト方式。自由記述のため）。
 * 改行とタブ以外の制御文字、書式文字（Cf）、見えない文字、点字の空白 U+2800、U+FFFC、U+2028、U+2029。
 */
const FORBIDDEN_MEMO_CHAR_PATTERN =
  /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u2800\uFFFC\u2028\u2029]/u;

/**
 * メモに使えない文字を含まないかを調べる。正当な絵文字の中の ZWJ・タグ文字は先に取り除いて例外にする。
 * @param value 文字列
 * @returns 禁止文字がなければ true
 */
export function hasNoForbiddenMemoChar(value: string): boolean {
  const withoutAllowed = value.replace(/[\n\r\t]/g, "").replace(RGI_EMOJI_GLOBAL, "");
  return !FORBIDDEN_MEMO_CHAR_PATTERN.test(withoutAllowed);
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
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 空文字を「入力なし」(null) にそろえる。フォームの空欄を任意項目として扱うため。
 * @param value 入力値
 * @returns 空なら null、それ以外はそのまま
 */
export function emptyToNull(value: unknown): unknown {
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
      // 見える文字（文字・数字・絵文字）が無い氏名は「未入力」と同じ扱いにする
      .refine(hasVisibleChar, { error: "nameRequired" })
      .max(PERSON_NAME_MAX_LENGTH, { error: "nameTooLong" })
      .refine((value) => hasOnlyAllowedNameChars(value), { error: "nameInvalidChar" }),
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
