import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail } from "@japan-politics/db";
import { AppointmentForm } from "@/components/appointment-form";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 人事の追加画面。管理者だけが使える。「閣僚を追加」（?category=minister）は役職を閣僚だけにし、
 * 「人事を追加」（指定なし）は内閣官房副長官・副大臣・大臣政務官も選べる。
 * @param props.params URL の動的部分（内閣 ID）
 * @param props.searchParams 検索パラメーター（category は "minister" だけを受け付ける。それ以外は指定なしと同じ）
 */
export default async function NewAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const { id } = await params;
  const cabinetId = parseCabinetId(id);
  if (cabinetId === null) notFound();
  const detail = await getCabinetDetail(getDb(), cabinetId);
  if (!detail) notFound();
  const t = await getTranslations("appointmentForm");
  const { category } = await searchParams;
  const onlyMinisters = category === "minister";
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">
        {onlyMinisters ? t("createTitle") : t("createPostTitle")}
      </h1>
      <p className="mt-4 text-body">
        {t("cabinetLabel")}:{" "}
        <span className="font-medium [overflow-wrap:anywhere]">{detail.name}</span>
      </p>
      <AppointmentForm
        cabinetId={detail.id}
        onlyMinisters={onlyMinisters}
        initial={{
          postName: "",
          person: null,
          startDate: "",
          endDate: "",
          sourceUrl: "",
          sourceNote: "",
        }}
      />
    </div>
  );
}
