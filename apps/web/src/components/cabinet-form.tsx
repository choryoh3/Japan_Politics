"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CABINET_NAME_MAX_LENGTH, validateCabinetInput } from "@japan-politics/db/cabinet-input";
import { errorsFromResponse, type FormErrors } from "@/lib/form-errors";
import {
  ERROR_TEXT_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

/** フォームの初期値。 */
export interface CabinetFormValues {
  name: string;
  startDate: string;
  endDate: string;
}

/** 画面にある入力項目の名前。 */
const FIELD_NAMES = ["name", "startDate", "endDate"] as const;

/**
 * 内閣の追加・修正フォーム。追加に成功したら内閣一覧へ、修正に成功したら内閣詳細へ移動する。
 * @param props.cabinetId 修正する内閣の ID。省略すると追加
 * @param props.initial 入力欄の初期値
 * @param props.cancelHref キャンセルで戻る先
 */
export function CabinetForm({
  cabinetId,
  initial,
  cancelHref,
}: {
  cabinetId?: number;
  initial: CabinetFormValues;
  cancelHref: string;
}) {
  const t = useTranslations("cabinetForm");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  // エラーが出るたびに増やす。同じエラーが続いても、最初の誤り欄へフォーカスを戻すため
  const [errorVersion, setErrorVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  // エラーが出たら、最初の誤りのある入力欄へフォーカスを移す（キーボード・読み上げの利用者のため）
  useEffect(() => {
    if (errorVersion === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errorVersion]);

  /**
   * エラーを画面に反映する。
   * @param next 項目ごとのエラー
   */
  function showErrors(next: FormErrors) {
    setErrors(next);
    setErrorVersion((version) => version + 1);
  }

  /** 入力を確認して API に送る。 */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = {
      name: String(form.get("name") ?? ""),
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
    };
    // サーバーと同じ検証関数を先に当てて、すぐに知らせる（サーバーでも必ず検証される）
    const checked = validateCabinetInput(raw);
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const response = await fetch(cabinetId ? `/api/cabinets/${cabinetId}` : "/api/cabinets", {
        method: cabinetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        showErrors(errorsFromResponse(response.status, body, FIELD_NAMES));
        return;
      }
      router.push(cabinetId ? `/cabinets/${cabinetId}` : "/");
      router.refresh();
    } catch {
      showErrors({ form: "unknown" });
    } finally {
      setBusy(false);
    }
  }

  /**
   * 項目のエラー文を出す。
   * @param field 項目名
   */
  function renderError(field: string) {
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
  function errorProps(field: string) {
    return {
      "aria-invalid": errors[field] ? (true as const) : undefined,
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
    };
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 max-w-xl space-y-6 border-t border-hairline pt-8"
    >
      <div>
        <label htmlFor="name" className="text-sm font-medium tracking-wider">
          {t("name")}
          <span aria-hidden="true" className="ml-2 text-mute">
            {t("required")}
          </span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          aria-required="true"
          defaultValue={initial.name}
          // 上限を超えて貼り付けても、サーバーと同じ検証で「長すぎる」と知らせられるよう余裕を持たせる
          maxLength={CABINET_NAME_MAX_LENGTH + 20}
          className={INPUT_CLASS}
          {...errorProps("name")}
        />
        {renderError("name")}
      </div>
      <div>
        <label htmlFor="startDate" className="text-sm font-medium tracking-wider">
          {t("startDate")}
          <span aria-hidden="true" className="ml-2 text-mute">
            {t("required")}
          </span>
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          aria-required="true"
          defaultValue={initial.startDate}
          className={INPUT_CLASS}
          {...errorProps("startDate")}
        />
        {renderError("startDate")}
      </div>
      <div>
        <label htmlFor="endDate" className="text-sm font-medium tracking-wider">
          {t("endDate")}
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={initial.endDate}
          className={INPUT_CLASS}
          {...errorProps("endDate")}
        />
        <p className="mt-2 text-sm text-mute">{t("endDateHint")}</p>
        {renderError("endDate")}
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
