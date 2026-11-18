import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail, type RosterRow } from "@japan-politics/db";
import { EndDate, FormattedDate } from "@/components/formatted-date";
import { getDb } from "@/lib/db";
import { parseIsoDate } from "@/lib/date";
import { parseCabinetId } from "@/lib/cabinet-id";

export const dynamic = "force-dynamic";

/**
 * 閣僚 1 行ぶんの在任期間の文言を作る（途中交代のときだけ値がある）。
 * @param row 閣僚名簿の行
 * @param formatDate 「YYYY-MM-DD」を表示用に直す関数
 * @param t 辞書
 * @returns 在任期間の文言。内閣の期間どおりなら null
 */
function tenureText(
  row: RosterRow,
  formatDate: (iso: string) => string,
  t: (
    key: "tenureFrom" | "tenureUntil" | "tenureBetween",
    values: Record<string, string>,
  ) => string,
): string | null {
  if (row.startDate && row.endDate) {
    return t("tenureBetween", { start: formatDate(row.startDate), end: formatDate(row.endDate) });
  }
  if (row.startDate) return t("tenureFrom", { date: formatDate(row.startDate) });
  if (row.endDate) return t("tenureUntil", { date: formatDate(row.endDate) });
  return null;
}

/**
 * 内閣詳細ページ。内閣名・在任期間と閣僚名簿（出典リンク付き）を表示する。
 * @param props.params URL の動的部分（内閣 ID）
 */
export default async function CabinetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cabinetId = parseCabinetId(id);
  if (cabinetId === null) notFound();

  const detail = await getCabinetDetail(getDb(), cabinetId);
  if (!detail) notFound();

  const t = await getTranslations("cabinetDetail");
  const tc = await getTranslations("common");
  const formatDate = (iso: string): string => {
    const parts = parseIsoDate(iso);
    return parts ? tc("dateFormat", parts) : iso;
  };

  return (
    <div>
      <Link href="/" className="link-inline inline-flex min-h-11 items-center text-sm">
        {tc("backToList")}
      </Link>
      <h1 className="mt-4 text-[32px] font-light leading-tight tracking-tight md:text-display-xl">
        {detail.name}
      </h1>
      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-1 text-body">
        <div className="flex gap-2">
          <dt>{t("startDate")}</dt>
          <dd className="text-ink">
            <FormattedDate date={detail.startDate} />
          </dd>
        </div>
        <div className="flex gap-2">
          <dt>{t("endDate")}</dt>
          <dd className="text-ink">
            <EndDate date={detail.endDate} />
          </dd>
        </div>
      </dl>

      <h2 className="mt-16 text-heading-lg font-light tracking-wide md:text-heading-xl">
        {t("rosterTitle")}
      </h2>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="border-b border-ink text-sm text-mute">
            <tr>
              <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                {t("columns.post")}
              </th>
              <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                {t("columns.name")}
              </th>
              <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                {t("columns.tenure")}
              </th>
              <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                {t("columns.source")}
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.roster.map((row) => (
              <tr key={row.id} className="border-b border-hairline hover:bg-row-hover">
                <td className="px-4 py-4 text-body first:pl-0">{row.postName}</td>
                <td className="px-4 py-4 text-lg font-medium">{row.personName}</td>
                <td className="px-4 py-4 text-sm text-mute">
                  {tenureText(row, formatDate, (key, values) => t(key, values))}
                </td>
                <td className="px-4 py-4">
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={row.sourceNote}
                    aria-label={t("sourceLabel", { post: row.postName })}
                    className="link-inline inline-flex min-h-11 items-center"
                  >
                    {tc("source")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
