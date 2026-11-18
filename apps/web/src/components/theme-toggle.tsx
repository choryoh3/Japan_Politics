"use client";

import { useTranslations } from "next-intl";

import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * ライト / ダークを切り替えるボタン。選択は localStorage に保存し、次回の表示でも保つ。
 * 現在の配色は、最初の描画前に layout のスクリプトが html の data-theme に入れている。
 */
export function ThemeToggle() {
  const t = useTranslations("common");

  /** 現在の配色を反転して、html に反映して保存する。 */
  function toggle() {
    const root = document.documentElement;
    // 明示の選択がなければ OS の設定が今の配色
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 保存できない環境（プライベートモードなど）でも、今のページの切替は有効にしておく
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-11 shrink-0 items-center rounded-full border border-on-dark/40 px-3 text-sm font-medium text-on-dark transition-colors hover:bg-on-dark/10 active:bg-on-dark/20 md:px-5"
    >
      {t("themeToggle")}
    </button>
  );
}
