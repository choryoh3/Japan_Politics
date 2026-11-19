import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/**
 * 管理者だけが見られる画面のための確認。
 * 未ログインならログイン画面へ移動する。管理者でなければ案内を表示するための null を返す。
 * @returns 管理者ならそのユーザー。管理者でなければ null
 */
export async function requireAdminOrRedirect(): Promise<CurrentUser | null> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current.role === "admin" ? current : null;
}

/**
 * 管理者でないユーザーに見せる「権限がありません」の案内。
 */
export async function ForbiddenNotice() {
  const t = await getTranslations("personForm");
  const tc = await getTranslations("common");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">
        {t("forbiddenTitle")}
      </h1>
      <p className="mt-4 max-w-[40em] text-body">{t("forbiddenBody")}</p>
      <Link href="/" className="link-inline mt-6 inline-flex min-h-11 items-center">
        {tc("backToList")}
      </Link>
    </div>
  );
}
