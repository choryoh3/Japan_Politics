import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getMinistryPage } from "@japan-politics/db";
import { MinistryHoldersTable } from "@/components/ministry-holders-table";
import { MinistryTabs } from "@/components/ministry-tabs";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** タブの並び（左から）。 */
const TAB_KEYS = ["minister", "viceMinister", "parliamentaryVice"] as const;

/**
 * 省庁ページ。府省名と、歴代の大臣・副大臣・大臣政務官のタブ（各タブは就任日の新しい順）を表示する。
 * 存在しない省庁 ID（数字でないものを含む）は「省庁が見つかりません」。
 * @param props.params URL の動的部分（省庁 ID）
 * @param props.searchParams 検索パラメーター（tab で最初に開くタブを指定できる）
 */
export default async function MinistryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const ministryId = parseCabinetId(id);
  if (ministryId === null) notFound();
  const page = await getMinistryPage(getDb(), ministryId);
  if (!page) notFound();

  const t = await getTranslations("ministries");
  const { tab } = await searchParams;

  return (
    <div>
      <Link
        href="/ministries"
        className="inline-flex min-h-11 items-center text-sm text-link underline underline-offset-4 hover:no-underline"
      >
        {t("backToList")}
      </Link>
      <h1 className="mt-6 text-[32px] font-light leading-tight tracking-tight [word-break:auto-phrase] md:text-display-xl">
        {page.name}
      </h1>
      <MinistryTabs
        idPrefix="ministry"
        label={t("tabsLabel")}
        initialKey={typeof tab === "string" ? tab : undefined}
        tabs={TAB_KEYS.map((key) => ({
          key,
          label: t(`tabs.${key}`),
          panel: <MinistryHoldersTable rows={page.holders[key]} tab={key} />,
        }))}
      />
    </div>
  );
}
