/** 入力欄の見た目（フォーム共通）。 */
export const INPUT_CLASS =
  "mt-2 block min-h-12 w-full rounded-lg border border-mute bg-canvas px-4 text-base text-ink transition-colors hover:border-ink focus-visible:border-link aria-[invalid=true]:border-2 aria-[invalid=true]:border-warning";

/** 主ボタン（青い丸ボタン）の見た目。 */
export const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-bold tracking-wider text-on-dark hover:bg-primary-pressed active:bg-ink-deep disabled:cursor-not-allowed disabled:opacity-60";

/** 副ボタン（枠だけの丸ボタン）の見た目。 */
export const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-ink px-7 text-base font-medium text-ink hover:bg-row-hover active:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60";

/** エラー文の見た目。 */
export const ERROR_TEXT_CLASS =
  "mt-2 border-l-2 border-warning pl-3 text-sm font-medium text-warning-ink";

/** 表の行の中の小さめのボタン（編集・削除）の見た目。タップしやすい高さ 44px は保つ。 */
export const ROW_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-ink px-4 text-sm font-medium text-ink hover:bg-row-hover active:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60";
