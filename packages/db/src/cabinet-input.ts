import { z } from "zod";
import {
  emptyToNull,
  hasNoForbiddenMemoChar,
  hasOnlyAllowedNameChars,
  hasVisibleChar,
  isRealDate,
  normalizeName,
  type AllowedTextOptions,
} from "./person-input.ts";
import { isCabinetPost } from "./cabinet-posts.ts";

/** 内閣名の最大文字数。 */
export const CABINET_NAME_MAX_LENGTH = 50;
/** 出典 URL の最大文字数。 */
export const SOURCE_URL_MAX_LENGTH = 2000;
/** 出典メモの最大文字数。 */
export const SOURCE_NOTE_MAX_LENGTH = 1000;

/**
 * 内閣名の許可設定。文字・数字・空白に加え、区切りは中黒「・」とハイフンだけ。絵文字は不可。
 * 例: 「第2次岸田改造内閣」「第1次安倍・麻生内閣」。
 */
const CABINET_NAME_OPTIONS: AllowedTextOptions = {
  allowEmoji: false,
  separators: new Set(["・", "-"]),
};

/**
 * URL に使ってよい文字（許可リスト）。RFC 3986 の予約文字・非予約文字と、日本語などの文字（\p{L}\p{N}\p{M}）。
 * 空白・制御文字・書式文字・見えない文字・引用符・山括弧・バックスラッシュなどは含まれない。
 */
const URL_ALLOWED_CHARS = /^(?:[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]|[\p{L}\p{N}\p{M}])+$/u;

/** 16 進 2 桁が続かない「%」（壊れたパーセントエンコード）。 */
const BROKEN_PERCENT = /%(?![0-9A-Fa-f]{2})/;

/**
 * 出典 URL として許せるかを調べる。許可リスト方式:
 * 「http://」か「https://」で始まる（javascript: や data: や file: は通らない）、
 * 許可した文字だけでできている、URL として解釈でき、ホスト名があり、ユーザー名・パスワードを含まない。
 * @param value 前後の空白を除いた URL
 * @returns 許せるなら true
 */
export function isAllowedSourceUrl(value: string): boolean {
  // 「http:///a」のように、スキームの後ろにホスト名が無いものは URL の解釈器が補ってしまうので、先に弾く
  if (!/^https?:\/\/[^/?#]/i.test(value)) return false;
  if (!URL_ALLOWED_CHARS.test(value) || BROKEN_PERCENT.test(value)) return false;
  try {
    const url = new URL(value);
    const schemeOk = url.protocol === "http:" || url.protocol === "https:";
    return schemeOk && url.hostname !== "" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

/**
 * 未入力（undefined・null）を空文字にそろえ、文字列は NFC に正規化する（任意の文字列欄用）。
 * @param value 入力値
 * @returns 正規化した文字列。文字列以外はそのまま（型の検証は後段で行う）
 */
function normalizeOptionalText(value: unknown): unknown {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.normalize("NFC") : value;
}

// ---- 内閣 ----

/** 内閣の入力の検証ルール。エラーは文言ではなくコードで、画面が辞書で日本語にする。 */
export const cabinetInputSchema = z.object({
  name: z.preprocess(
    normalizeName,
    z
      .string({ error: "nameRequired" })
      .trim()
      .min(1, { error: "nameRequired" })
      // 見える文字が無い内閣名は「未入力」と同じ扱いにする
      .refine(hasVisibleChar, { error: "nameRequired" })
      .max(CABINET_NAME_MAX_LENGTH, { error: "nameTooLong" })
      .refine((value) => hasOnlyAllowedNameChars(value, CABINET_NAME_OPTIONS), {
        error: "nameInvalidChar",
      }),
  ),
  startDate: z.preprocess(
    emptyToNull,
    z
      .string({ error: "startDateRequired" })
      .trim()
      .refine(isRealDate, { error: "startDateInvalid" }),
  ),
  endDate: z.preprocess(
    emptyToNull,
    z
      .string({ error: "endDateInvalid" })
      .trim()
      .refine(isRealDate, { error: "endDateInvalid" })
      .nullable(),
  ),
});

/** 検証済みの内閣入力。 */
export type CabinetInput = z.infer<typeof cabinetInputSchema>;

/** 項目ごとのエラーコード。 */
export type CabinetInputErrors = Partial<Record<keyof CabinetInput, string>>;

/**
 * 内閣の入力を検証する。画面と API の両方が、この同じ関数を通す。
 * @param raw 外部から来た入力（形式は問わない）
 * @returns 成功なら検証済みの値、失敗なら項目ごとのエラーコード
 */
export function validateCabinetInput(
  raw: unknown,
): { ok: true; value: CabinetInput } | { ok: false; errors: CabinetInputErrors } {
  const result = cabinetInputSchema.safeParse(raw ?? {});
  if (result.success) {
    const { startDate, endDate } = result.data;
    // 日付の文字列は「YYYY-MM-DD」なので、文字列の大小がそのまま日付の前後になる
    if (endDate !== null && endDate < startDate) {
      return { ok: false, errors: { endDate: "endDateBeforeStart" } };
    }
    return { ok: true, value: result.data };
  }
  const errors: CabinetInputErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === "name" || field === "startDate" || field === "endDate") && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}

// ---- 閣僚人事 ----

/** 人物 ID の入力（数値、または数字だけの文字列）を数値にそろえる。 */
function normalizePersonId(value: unknown): unknown {
  return typeof value === "string" && /^[0-9]{1,15}$/.test(value.trim())
    ? Number(value.trim())
    : value;
}

/** 閣僚人事の入力の検証ルール。 */
export const appointmentInputSchema = z.object({
  postName: z.preprocess(
    (value) => (typeof value === "string" ? value.normalize("NFC").trim() : value),
    z
      .string({ error: "postRequired" })
      .min(1, { error: "postRequired" })
      // 役職は初期データで用意したものから選ぶ（自由入力は表記ゆれで重なりの検査をすり抜けるため）
      .refine(isCabinetPost, { error: "postInvalid" }),
  ),
  personId: z.preprocess(
    normalizePersonId,
    z
      .number({ error: "personRequired" })
      .int({ error: "personRequired" })
      .min(1, { error: "personRequired" })
      .max(Number.MAX_SAFE_INTEGER, { error: "personRequired" }),
  ),
  startDate: z.preprocess(
    emptyToNull,
    z
      .string({ error: "startDateInvalid" })
      .trim()
      .refine(isRealDate, { error: "startDateInvalid" })
      .nullable(),
  ),
  endDate: z.preprocess(
    emptyToNull,
    z
      .string({ error: "endDateInvalid" })
      .trim()
      .refine(isRealDate, { error: "endDateInvalid" })
      .nullable(),
  ),
  sourceUrl: z.preprocess(
    normalizeOptionalText,
    z
      .string({ error: "sourceUrlInvalid" })
      .trim()
      .max(SOURCE_URL_MAX_LENGTH, { error: "sourceUrlTooLong" })
      // 空欄は「出典 URL なし」。入力があれば http(s) の URL に限る
      .refine((value) => value === "" || isAllowedSourceUrl(value), { error: "sourceUrlInvalid" }),
  ),
  sourceNote: z.preprocess(
    normalizeOptionalText,
    z
      .string({ error: "sourceNoteInvalid" })
      .trim()
      .max(SOURCE_NOTE_MAX_LENGTH, { error: "sourceNoteTooLong" })
      .refine(hasNoForbiddenMemoChar, { error: "sourceNoteInvalidChar" }),
  ),
});

/** 検証済みの閣僚人事入力。 */
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

/** 項目ごとのエラーコード。 */
export type AppointmentInputErrors = Partial<Record<keyof AppointmentInput, string>>;

/**
 * 閣僚人事の入力を検証する。画面と API の両方が、この同じ関数を通す。
 * 内閣の期間内か・役職の重なりなど、DB を見ないと分からない検査は書き込み側（cabinet-write）が行う。
 * @param raw 外部から来た入力（形式は問わない）
 * @returns 成功なら検証済みの値、失敗なら項目ごとのエラーコード
 */
export function validateAppointmentInput(
  raw: unknown,
): { ok: true; value: AppointmentInput } | { ok: false; errors: AppointmentInputErrors } {
  const result = appointmentInputSchema.safeParse(raw ?? {});
  if (result.success) {
    const { startDate, endDate } = result.data;
    if (startDate !== null && endDate !== null && endDate < startDate) {
      return { ok: false, errors: { endDate: "endDateBeforeStart" } };
    }
    return { ok: true, value: result.data };
  }
  const errors: AppointmentInputErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      (field === "postName" ||
        field === "personId" ||
        field === "startDate" ||
        field === "endDate" ||
        field === "sourceUrl" ||
        field === "sourceNote") &&
      !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}
