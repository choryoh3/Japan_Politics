"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import {
  PERSON_MEMO_MAX_LENGTH,
  validatePersonInput,
  type PersonInputErrors,
} from "@japan-politics/db/person-input";
import {
  ERROR_TEXT_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

/** フォームの初期値。 */
export interface PersonFormValues {
  name: string;
  kana: string;
  birthDate: string;
  memo: string;
}

/** 項目ごとのエラー（辞書のキー）。form は項目に結びつかないエラー。 */
type Errors = PersonInputErrors & { form?: string };

/**
 * 保存 API の失敗応答を、画面に出すエラーにする。
 * @param status HTTP ステータス
 * @param body 応答の本文（JSON でなければ undefined）
 * @returns 項目ごとのエラー
 */
function errorsFromResponse(status: number, body: unknown): Errors {
  if (status === 401) return { form: "unauthorized" };
  if (status === 403) return { form: "forbidden" };
  const fields =
    typeof body === "object" && body !== null && "fields" in body
      ? (body as { fields?: unknown }).fields
      : undefined;
  if (typeof fields === "object" && fields !== null) {
    const result: Errors = {};
    for (const key of ["name", "kana", "birthDate", "memo"] as const) {
      const value = (fields as Record<string, unknown>)[key];
      if (typeof value === "string") result[key] = value;
    }
    if (Object.keys(result).length > 0) return result;
  }
  return { form: "unknown" };
}

/**
 * 人物の追加・修正フォーム。保存に成功したら人物ページへ移動する。
 * @param props.personId 修正する人物の ID。省略すると追加
 * @param props.initial 入力欄の初期値
 * @param props.cancelHref キャンセルで戻る先
 */
export function PersonForm({
  personId,
  initial,
  cancelHref,
}: {
  personId?: number;
  initial: PersonFormValues;
  cancelHref: string;
}) {
  const t = useTranslations("personForm");
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  /** 入力を確認して API に送る。 */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = {
      name: String(form.get("name") ?? ""),
      kana: String(form.get("kana") ?? ""),
      birthDate: String(form.get("birthDate") ?? ""),
      memo: String(form.get("memo") ?? ""),
    };
    // サーバーと同じ検証ルールを先に当てて、すぐに知らせる（サーバーでも必ず検証される）
    const checked = validatePersonInput(raw);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const response = await fetch(personId ? `/api/persons/${personId}` : "/api/persons", {
        method: personId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        setErrors(errorsFromResponse(response.status, body));
        return;
      }
      const id = (body as { id?: number } | undefined)?.id ?? personId;
      router.push(`/persons/${id}`);
      router.refresh();
    } catch {
      setErrors({ form: "unknown" });
    } finally {
      setBusy(false);
    }
  }

  /**
   * 項目のエラー文を出す。
   * @param field 項目名
   */
  function renderError(field: keyof Errors) {
    const key = errors[field];
    if (!key) return null;
    return (
      <p id={`${field}-error`} role="alert" className={ERROR_TEXT_CLASS}>
        {t(`errors.${key}`)}
      </p>
    );
  }

  /**
   * 項目のエラー表示用の属性（読み上げと見た目のため）。
   * @param field 項目名
   */
  function errorProps(field: keyof Errors) {
    return {
      "aria-invalid": errors[field] ? (true as const) : undefined,
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
    };
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 max-w-xl space-y-6 border-t border-hairline pt-8"
    >
      <div>
        <label htmlFor="name" className="text-sm font-medium tracking-wider">
          {t("name")} <span className="ml-1 text-mute">{t("required")}</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initial.name}
          className={INPUT_CLASS}
          {...errorProps("name")}
        />
        {renderError("name")}
      </div>
      <div>
        <label htmlFor="kana" className="text-sm font-medium tracking-wider">
          {t("kana")} <span className="ml-1 text-mute">{t("required")}</span>
        </label>
        <input
          id="kana"
          name="kana"
          type="text"
          defaultValue={initial.kana}
          className={INPUT_CLASS}
          {...errorProps("kana")}
        />
        <p className="mt-2 text-sm text-mute">{t("kanaHint")}</p>
        {renderError("kana")}
      </div>
      <div>
        <label htmlFor="birthDate" className="text-sm font-medium tracking-wider">
          {t("birthDate")}
        </label>
        <input
          id="birthDate"
          name="birthDate"
          type="date"
          defaultValue={initial.birthDate}
          className={INPUT_CLASS}
          {...errorProps("birthDate")}
        />
        {renderError("birthDate")}
      </div>
      <div>
        <label htmlFor="memo" className="text-sm font-medium tracking-wider">
          {t("memo")}
        </label>
        <textarea
          id="memo"
          name="memo"
          rows={4}
          maxLength={PERSON_MEMO_MAX_LENGTH + 100}
          defaultValue={initial.memo}
          className={`${INPUT_CLASS} py-3`}
          {...errorProps("memo")}
        />
        {renderError("memo")}
      </div>
      {renderError("form")}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
          {busy ? t("saving") : t("save")}
        </button>
        <Link href={cancelHref} className={SECONDARY_BUTTON_CLASS}>
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
