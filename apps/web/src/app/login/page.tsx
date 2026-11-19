import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * login 画面。ログイン済みならトップへ移動する。
 */
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">{t("loginTitle")}</h1>
      <AuthForm mode="login" />
    </div>
  );
}
