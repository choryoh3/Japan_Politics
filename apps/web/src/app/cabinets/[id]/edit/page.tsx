import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail } from "@japan-politics/db";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";
import { CabinetForm } from "@/components/cabinet-form";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 内閣の修正画面。管理者だけが使える。
 * @param props.params URL の動的部分（内閣 ID）
 */
export default async function EditCabinetPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const { id } = await params;
  const cabinetId = parseCabinetId(id);
  if (cabinetId === null) notFound();
  const detail = await getCabinetDetail(getDb(), cabinetId);
  if (!detail) notFound();
  const t = await getTranslations("cabinetForm");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">{t("editTitle")}</h1>
      <CabinetForm
        cabinetId={detail.id}
        initial={{
          name: detail.name,
          startDate: detail.startDate,
          endDate: detail.endDate ?? "",
        }}
        cancelHref={`/cabinets/${detail.id}`}
      />
    </div>
  );
}
