import { getTranslations } from "next-intl/server";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";
import { PersonForm } from "@/components/person-form";

export const dynamic = "force-dynamic";

/**
 * 人物の追加画面。管理者だけが使える（未ログインはログイン画面へ、一般ユーザーには案内を表示）。
 */
export default async function NewPersonPage() {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const t = await getTranslations("personForm");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">
        {t("createTitle")}
      </h1>
      <PersonForm initial={{ name: "", kana: "", birthDate: "", memo: "" }} cancelHref="/" />
    </div>
  );
}
