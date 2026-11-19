"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-constants";
import { ERROR_TEXT_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";

/** 画面の種類。 */
type Mode = "login" | "register";

/** 項目ごとのエラー（辞書のキー）。 */
type FieldErrors = Partial<Record<"name" | "email" | "password" | "form", string>>;

const emailSchema = z.email();

/**
 * Better Auth のエラーコードを、画面に出す辞書のキーにする。
 * @param code Better Auth のエラーコード（無いこともある）
 * @returns auth.errors のキー
 */
function errorKeyFromCode(code: string | undefined): string {
  if (!code) return "unknown";
  if (code.includes("PASSWORD_TOO_SHORT")) return "passwordTooShort";
  if (code.includes("PASSWORD_TOO_LONG")) return "passwordTooLong";
  if (code.includes("USER_ALREADY_EXISTS")) return "emailTaken";
  if (code.includes("INVALID_EMAIL_OR_PASSWORD")) return "invalidCredentials";
  if (code.includes("INVALID_EMAIL")) return "emailInvalid";
  return "unknown";
}

/**
 * 入力を送る前にブラウザ側で確認する（同じ確認をサーバーでも行う）。
 * @param mode 登録かログインか
 * @param values 入力値
 * @returns 項目ごとのエラー。なければ空
 */
function validate(
  mode: Mode,
  values: { name: string; email: string; password: string },
): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "register" && values.name.trim() === "") errors.name = "nameRequired";
  if (values.email.trim() === "") errors.email = "emailRequired";
  else if (!emailSchema.safeParse(values.email.trim()).success) errors.email = "emailInvalid";
  if (values.password === "") errors.password = "passwordRequired";
  else if (mode === "register" && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = "passwordTooShort";
  }
  return errors;
}

/**
 * 登録・ログインのフォーム。成功したらトップへ移動し、ヘッダーをログイン状態にする。
 * @param props.mode "register"（登録）か "login"（ログイン）
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  /** 入力を確認して送信する。 */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const found = validate(mode, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const result =
        mode === "register"
          ? await authClient.signUp.email({
              name: values.name.trim(),
              email: values.email.trim(),
              password: values.password,
            })
          : await authClient.signIn.email({
              email: values.email.trim(),
              password: values.password,
            });
      if (result.error) {
        const key = errorKeyFromCode(result.error.code);
        setErrors(key === "passwordTooShort" ? { password: key } : { form: key });
        return;
      }
      router.push("/");
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
  function renderError(field: keyof FieldErrors) {
    const key = errors[field];
    if (!key) return null;
    return (
      <p id={`${field}-error`} role="alert" className={ERROR_TEXT_CLASS}>
        {t(`errors.${key}`)}
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 max-w-md space-y-6 border-t border-hairline pt-8"
    >
      {mode === "register" ? (
        <div>
          <label htmlFor="name" className="text-sm font-medium tracking-wider">
            {t("displayName")}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="nickname"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={INPUT_CLASS}
          />
          {renderError("name")}
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="text-sm font-medium tracking-wider">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={INPUT_CLASS}
        />
        {renderError("email")}
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium tracking-wider">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={INPUT_CLASS}
        />
        {mode === "register" ? <p className="mt-2 text-sm text-mute">{t("passwordHint")}</p> : null}
        {renderError("password")}
      </div>
      {renderError("form")}
      <div className="flex flex-wrap items-center gap-6">
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
          {busy ? t("submitting") : mode === "register" ? t("registerSubmit") : t("loginSubmit")}
        </button>
        <Link href={mode === "register" ? "/login" : "/register"} className="link-inline">
          {mode === "register" ? t("toLogin") : t("toRegister")}
        </Link>
      </div>
    </form>
  );
}
