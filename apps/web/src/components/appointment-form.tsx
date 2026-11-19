"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  SOURCE_NOTE_MAX_LENGTH,
  SOURCE_URL_MAX_LENGTH,
  validateAppointmentInput,
} from "@japan-politics/db/cabinet-input";
import { CABINET_POSTS } from "@japan-politics/db/cabinet-posts";
import { PersonPicker, type PickedPerson } from "@/components/person-picker";
import { errorsFromResponse, type FormErrors } from "@/lib/form-errors";
import {
  ERROR_TEXT_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

/** フォームの初期値。 */
export interface AppointmentFormValues {
  postName: string;
  person: PickedPerson | null;
  startDate: string;
  endDate: string;
  sourceUrl: string;
  sourceNote: string;
}

/** 画面にある入力項目の名前（API のエラーの項目名と同じ）。 */
const FIELD_NAMES = [
  "postName",
  "personId",
  "startDate",
  "endDate",
  "sourceUrl",
  "sourceNote",
] as const;

/**
 * 閣僚人事の追加・修正フォーム。保存に成功したら内閣詳細（閣僚名簿）へ移動する。
 * @param props.cabinetId 対象の内閣 ID
 * @param props.appointmentId 修正する人事の ID。省略すると追加
 * @param props.initial 入力欄の初期値
 */
export function AppointmentForm({
  cabinetId,
  appointmentId,
  initial,
}: {
  cabinetId: number;
  appointmentId?: number;
  initial: AppointmentFormValues;
}) {
  const t = useTranslations("appointmentForm");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [person, setPerson] = useState<PickedPerson | null>(initial.person);
  const [errors, setErrors] = useState<FormErrors>({});
  // エラーが出るたびに増やす。同じエラーが続いても、最初の誤り欄へフォーカスを戻すため
  const [errorVersion, setErrorVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const cabinetHref = `/cabinets/${cabinetId}`;

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
      postName: String(form.get("postName") ?? ""),
      personId: person?.id,
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      sourceUrl: String(form.get("sourceUrl") ?? ""),
      sourceNote: String(form.get("sourceNote") ?? ""),
    };
    // サーバーと同じ検証関数を先に当てて、すぐに知らせる（サーバーでも必ず検証される）
    const checked = validateAppointmentInput(raw);
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const base = `/api/cabinets/${cabinetId}/appointments`;
      const response = await fetch(appointmentId ? `${base}/${appointmentId}` : base, {
        method: appointmentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        showErrors(errorsFromResponse(response.status, body, FIELD_NAMES));
        return;
      }
      router.push(cabinetHref);
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
        <label htmlFor="postName" className="text-sm font-medium tracking-wider">
          {t("postName")}
          <span aria-hidden="true" className="ml-2 text-mute">
            {t("required")}
          </span>
        </label>
        <select
          id="postName"
          name="postName"
          aria-required="true"
          defaultValue={initial.postName}
          className={INPUT_CLASS}
          {...errorProps("postName")}
        >
          <option value="">{t("postPlaceholder")}</option>
          {CABINET_POSTS.map((post) => (
            <option key={post.name} value={post.name}>
              {post.name}
            </option>
          ))}
        </select>
        {renderError("postName")}
      </div>
      <div>
        <PersonPicker
          value={person}
          onChange={setPerson}
          inputId="person"
          invalid={Boolean(errors.personId)}
          describedBy="personId-error"
        />
        {renderError("personId")}
      </div>
      <div>
        <label htmlFor="startDate" className="text-sm font-medium tracking-wider">
          {t("startDate")}
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
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
        <p className="mt-2 text-sm text-mute">{t("dateHint")}</p>
        {renderError("endDate")}
      </div>
      <div>
        <label htmlFor="sourceUrl" className="text-sm font-medium tracking-wider">
          {t("sourceUrl")}
        </label>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="text"
          inputMode="url"
          autoComplete="off"
          defaultValue={initial.sourceUrl}
          maxLength={SOURCE_URL_MAX_LENGTH + 100}
          className={INPUT_CLASS}
          {...errorProps("sourceUrl")}
        />
        <p className="mt-2 text-sm text-mute">{t("sourceUrlHint")}</p>
        {renderError("sourceUrl")}
      </div>
      <div>
        <label htmlFor="sourceNote" className="text-sm font-medium tracking-wider">
          {t("sourceNote")}
        </label>
        <textarea
          id="sourceNote"
          name="sourceNote"
          rows={3}
          maxLength={SOURCE_NOTE_MAX_LENGTH + 100}
          defaultValue={initial.sourceNote}
          className={`${INPUT_CLASS} py-3`}
          {...errorProps("sourceNote")}
        />
        {renderError("sourceNote")}
      </div>
      {renderError("form")}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
          {busy ? t("saving") : t("save")}
        </button>
        <Link href={cabinetHref} className={SECONDARY_BUTTON_CLASS}>
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
