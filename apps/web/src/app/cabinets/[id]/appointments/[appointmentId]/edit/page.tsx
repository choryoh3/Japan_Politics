import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail } from "@japan-politics/db";
import { AppointmentForm } from "@/components/appointment-form";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 閣僚人事の修正画面。管理者だけが使える。他の内閣の人事 ID を指定したときは「見つかりません」。
 * @param props.params URL の動的部分（内閣 ID と人事 ID）
 */
export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string; appointmentId: string }>;
}) {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const { id, appointmentId } = await params;
  const cabinetId = parseCabinetId(id);
  const rowId = parseCabinetId(appointmentId);
  if (cabinetId === null || rowId === null) notFound();
  const detail = await getCabinetDetail(getDb(), cabinetId);
  const row = detail?.roster.find((item) => item.id === rowId);
  if (!detail || !row) notFound();
  const t = await getTranslations("appointmentForm");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">{t("editTitle")}</h1>
      <p className="mt-4 text-body">
        {t("cabinetLabel")}:{" "}
        <span className="font-medium [overflow-wrap:anywhere]">{detail.name}</span>
      </p>
      <AppointmentForm
        cabinetId={detail.id}
        appointmentId={row.id}
        initial={{
          postName: row.postName,
          person: { id: row.personId, name: row.personName },
          startDate: row.startDate ?? "",
          endDate: row.endDate ?? "",
          sourceUrl: row.sourceUrl,
          sourceNote: row.sourceNote,
        }}
      />
    </div>
  );
}
