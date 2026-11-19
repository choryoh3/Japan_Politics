import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth";

/** ヘッダーのリンクの見た目（黒地に白文字）。 */
const NAV_LINK_CLASS =
  "inline-flex min-h-11 items-center text-sm text-on-dark underline-offset-4 hover:underline";

/**
 * ヘッダーのログイン状態の表示。
 * 未ログインは「ログイン」「新規登録」、ログイン中は表示名・（管理者なら）「人物を追加」・「ログアウト」を出す。
 * 管理者かどうかはサーバーが判断した結果だけを画面に出す。
 */
export async function AuthNav() {
  const t = await getTranslations("nav");
  const current = await getCurrentUser();

  if (!current) {
    return (
      <nav aria-label={t("account")} className="flex items-center gap-x-4 md:gap-x-6">
        <Link href="/login" className={NAV_LINK_CLASS}>
          {t("login")}
        </Link>
        <Link href="/register" className={NAV_LINK_CLASS}>
          {t("register")}
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label={t("account")} className="flex min-w-0 items-center gap-x-4 md:gap-x-4">
      <span
        className="max-w-24 truncate text-sm text-on-dark md:max-w-24 lg:max-w-40 xl:max-w-56"
        data-testid="current-user-name"
        title={current.name}
      >
        {current.name}
      </span>
      {current.role === "admin" ? (
        <Link href="/persons/new" className={NAV_LINK_CLASS}>
          {t("addPerson")}
        </Link>
      ) : null}
      <LogoutButton label={t("logout")} className={NAV_LINK_CLASS} />
    </nav>
  );
}
