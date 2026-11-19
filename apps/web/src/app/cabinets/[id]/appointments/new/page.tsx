import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail } from "@japan-politics/db";
import { AppointmentForm } from "@/components/appointment-form";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 閣僚の追加画面。管理者だけが使える。
 * @param props.params URL の動的部分（内閣 ID）
 */
export default async function NewAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const { id } = await params;
  const cabinetId = parseCabinetId(id);
  if (cabinetId === null) notFound();
  const detail = await getCabinetDetail(getDb(), cabinetId);
  if (!detail) notFound();
  const t = await getTranslations("appointmentForm");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">
        {t("createTitle")}
      </h1>
      <p className="mt-4 text-body">
        {t("cabinetLabel")}: <span className="font-medium">{detail.name}</span>
      </p>
      <AppointmentForm
        cabinetId={detail.id}
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
