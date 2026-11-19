import { getTranslations } from "next-intl/server";
import { CabinetForm } from "@/components/cabinet-form";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";

export const dynamic = "force-dynamic";

/**
 * 内閣の追加画面。管理者だけが使える（未ログインはログイン画面へ、一般ユーザーには案内を表示）。
 */
export default async function NewCabinetPage() {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const t = await getTranslations("cabinetForm");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">
        {t("createTitle")}
      </h1>
      <CabinetForm initial={{ name: "", startDate: "", endDate: "" }} cancelHref="/" />
    </div>
  );
}
