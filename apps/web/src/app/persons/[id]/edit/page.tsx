import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPersonProfile } from "@japan-politics/db";
import { ForbiddenNotice, requireAdminOrRedirect } from "@/components/admin-gate";
import { PersonForm } from "@/components/person-form";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 人物の修正画面。管理者だけが使える。
 * @param props.params URL の動的部分（人物 ID）
 */
export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminOrRedirect();
  if (!admin) return <ForbiddenNotice />;
  const { id } = await params;
  const personId = parseCabinetId(id);
  if (personId === null) notFound();
  const profile = await getPersonProfile(getDb(), personId);
  if (!profile) notFound();
  const t = await getTranslations("personForm");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight md:text-display-xl">{t("editTitle")}</h1>
      <PersonForm
        personId={profile.id}
        initial={{
          name: profile.name,
          kana: profile.kana,
          birthDate: profile.birthDate ?? "",
          memo: profile.memo ?? "",
        }}
        cancelHref={`/persons/${profile.id}`}
      />
    </div>
  );
}
