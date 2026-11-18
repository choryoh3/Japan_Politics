import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail, type RosterRow } from "@japan-politics/db";
import { CabinetName } from "@/components/cabinet-name";
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
      {/* 章の帯: 画面いっぱいの青地。影を使って、幅いっぱいに広げても横スクロールを出さない */}
      <section className="on-primary relative isolate -mt-12 px-0 pb-12 pt-6 text-on-dark before:absolute before:inset-y-0 before:-left-[100vmax] before:-right-[100vmax] before:-z-10 before:bg-primary [clip-path:inset(0_-100vmax)] md:-mt-16 md:pb-16">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-on-dark underline underline-offset-4 hover:no-underline"
        >
          {tc("backToList")}
        </Link>
        <h1 className="mt-6 text-[32px] font-light leading-tight tracking-tight [text-wrap:balance] md:text-display-xl">
          <CabinetName name={detail.name} />
        </h1>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-1 border-t border-on-dark/40 pt-6 text-on-dark">
          <div className="flex gap-2">
            <dt className="font-light text-on-dark">{t("startDate")}</dt>
            <dd className="font-medium">
              <FormattedDate date={detail.startDate} />
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-light text-on-dark">{t("endDate")}</dt>
            <dd className="font-medium [&_span]:border-on-dark [&_span]:text-on-dark">
              <EndDate date={detail.endDate} />
            </dd>
          </div>
        </dl>
      </section>

      <h2 className="mt-12 text-heading-lg font-light tracking-wide md:text-heading-xl">
        {t("rosterTitle")}
      </h2>
      <div className="mt-6">
        {/* md 未満は 1 行ずつ縦に積む（横スクロールに頼らない）。md 以上は列幅固定の表 */}
        <table
          aria-label={t("tableLabel")}
          className="block w-full border-collapse text-left md:table md:table-fixed"
        >
          <thead className="max-md:sr-only border-b border-ink text-sm text-mute md:table-header-group">
            <tr className="md:table-row">
              <th
                scope="col"
                className="w-[34%] whitespace-nowrap px-4 py-4 font-medium tracking-wider first:pl-0"
              >
                {t("columns.post")}
              </th>
              <th
                scope="col"
                className="w-[26%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
              >
                {t("columns.name")}
              </th>
              <th
                scope="col"
                className="w-[24%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
              >
                {t("columns.tenure")}
              </th>
              <th
                scope="col"
                className="w-[16%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
              >
                {t("columns.source")}
              </th>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {detail.roster.map((row) => (
              <tr
                key={row.id}
                className="border-b border-hairline hover:bg-row-hover max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-between max-md:gap-x-4 max-md:py-4"
              >
                <td className="px-4 py-4 text-body first:pl-0 max-md:w-full max-md:p-0 max-md:text-sm max-md:text-mute">
                  {row.postName}
                </td>
                <td className="px-4 py-4 text-lg font-medium max-md:p-0">
                  <Link
                    href={`/persons/${row.personId}`}
                    className="link-inline inline-flex min-h-11 items-center"
                  >
                    {row.personName}
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm text-mute md:whitespace-nowrap max-md:order-last max-md:empty:hidden max-md:w-full max-md:p-0">
                  {tenureText(row, formatDate, (key, values) => t(key, values))}
                </td>
                <td className="px-4 py-4 max-md:p-0">
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
