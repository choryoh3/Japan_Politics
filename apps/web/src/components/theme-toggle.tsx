"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  parseTheme,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * 配色を cookie と localStorage に保存する。cookie はサーバーが次の表示で読む。
 * @param theme 保存する配色
 */
function saveTheme(theme: ThemeChoice) {
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 保存できない環境（プライベートモードなど）でも、今のページの切替は有効にしておく
  }
}

/**
 * localStorage に保存済みの配色を読む。読めなければ undefined。
 * @returns 保存済みの配色
 */
function readStoredTheme(): ThemeChoice | undefined {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/**
 * ライト / ダークを切り替えるボタン。選択は localStorage に保存し、次回の表示でも保つ。
 * 最初の配色は、layout が cookie から読んで html の data-theme に入れている。
 */
export function ThemeToggle() {
  const t = useTranslations("common");

  // 保険：cookie が無い旧い保存（localStorage のみ）や、not-found から移動した直後でも、保存値を html に再適用する
  useEffect(() => {
    const stored = readStoredTheme();
    if (!stored) return;
    document.documentElement.dataset.theme = stored;
    saveTheme(stored);
  }, []);

  /** 現在の配色を反転して、html に反映して保存する。 */
  function toggle() {
    const root = document.documentElement;
    // 明示の選択がなければ OS の設定が今の配色
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    saveTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-11 shrink-0 items-center rounded-full border border-on-dark/40 px-3 text-sm font-medium text-on-dark transition-colors hover:bg-on-dark/10 active:bg-on-dark/20 md:px-4 lg:px-5"
    >
      {t("themeToggle")}
    </button>
  );
}
