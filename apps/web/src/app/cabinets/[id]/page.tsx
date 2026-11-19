import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCabinetDetail, type RosterRow } from "@japan-politics/db";
import { CabinetName } from "@/components/cabinet-name";
import { EndDate, FormattedDate } from "@/components/formatted-date";
import { RosterRowActions } from "@/components/roster-row-actions";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SECONDARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { parseIsoDate } from "@/lib/date";
import { parseCabinetId } from "@/lib/cabinet-id";

export const dynamic = "force-dynamic";

/**
 * 閣僚 1 行ぶんの在任期間の文言を作る（途中交代のときだけ値がある）。
 * @param row 閣僚名簿の行
 * @param formatDate 「YYYY-MM-DD」を表示用に直す関数
 * @param t 辞書
 * @returns 在任期間の表示。内閣の期間どおりなら null
 */
function tenureText(
  row: RosterRow,
  formatDate: (iso: string) => string,
  t: (
    key: "tenureFrom" | "tenureUntil" | "tenureBetween",
    values: Record<string, string>,
  ) => string,
): ReactNode {
  if (row.startDate && row.endDate) {
    // 「…から」「…まで」を 1 かたまりずつ折り返さない span にし、間の <wbr> でだけ折り返す。
    // 文言は辞書の tenureFrom / tenureUntil と同じなので、読み上げ・検索で見える文字列は変わらない
    return (
      <>
        <span className="whitespace-nowrap">
          {t("tenureFrom", { date: formatDate(row.startDate) })}
        </span>
        <wbr />
        <span className="whitespace-nowrap">
          {t("tenureUntil", { date: formatDate(row.endDate) })}
        </span>
      </>
    );
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

  const current = await getCurrentUser();
  // 編集の操作は管理者にだけ描画する（権限の最終確認は API が行う）
  const isAdmin = current?.role === "admin";
  const t = await getTranslations("cabinetDetail");
  const tc = await getTranslations("common");
  const formatDate = (iso: string): string => {
    const parts = parseIsoDate(iso);
    return parts ? tc("dateFormat", parts) : iso;
  };

  // Tailwind は完成した文字列しか拾えないので、管理者／一般でクラスを丸ごと書き分ける
  const tableClass = isAdmin ? "block lg:table lg:table-fixed" : "block md:table md:table-fixed";
  const theadClass = isAdmin
    ? "max-lg:sr-only lg:table-header-group"
    : "max-md:sr-only md:table-header-group";
  const trHeadClass = isAdmin ? "lg:table-row" : "md:table-row";
  const tbodyClass = isAdmin ? "max-lg:block" : "max-md:block";
  const rowClass = isAdmin
    ? "max-lg:flex max-lg:flex-wrap max-lg:items-center max-lg:justify-between max-lg:gap-x-4 max-lg:py-4"
    : "max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-between max-md:gap-x-4 max-md:py-4";
  const postCellClass = isAdmin
    ? "max-lg:w-full max-lg:p-0 max-lg:text-sm max-lg:text-mute"
    : "max-md:w-full max-md:p-0 max-md:text-sm max-md:text-mute";
  const nameCellClass = isAdmin ? "max-lg:p-0" : "max-md:p-0";
  // 管理者のカードでは在任を氏名のすぐ下に置く（DOM 順のまま。Tab 順と見た目の順を一致させる）
  const tenureCellClass = isAdmin
    ? "max-lg:w-full max-lg:p-0 max-lg:empty:hidden"
    : "max-md:order-last max-md:w-full max-md:p-0 max-md:empty:hidden";
  const sourceCellClass = isAdmin ? "max-lg:p-0" : "max-md:p-0";
  const actionsCellClass = "lg:whitespace-nowrap max-lg:w-full max-lg:p-0";

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

      {isAdmin ? (
        <div role="group" aria-label={t("adminActions")} className="mt-10 flex flex-wrap gap-4">
          <Link href={`/cabinets/${detail.id}/edit`} className={SECONDARY_BUTTON_CLASS}>
            {t("editCabinet")}
          </Link>
          <Link href={`/cabinets/${detail.id}/appointments/new`} className={SECONDARY_BUTTON_CLASS}>
            {t("addAppointment")}
          </Link>
        </div>
      ) : null}

      <h2 className="mt-12 text-heading-lg font-light tracking-wide md:text-heading-xl">
        {t("rosterTitle")}
      </h2>
      {detail.roster.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface-card p-8 text-body">{t("empty")}</p>
      ) : (
        <div className="mt-6">
          {/* 一般は md 以上、管理者（5 列で幅が要る）は lg 以上が列幅固定の表。それ未満は 1 行ずつ縦に積む（横スクロールに頼らない） */}
          <table
            aria-label={t("tableLabel")}
            className={`${tableClass} w-full border-collapse text-left`}
          >
            <thead className={`${theadClass} border-b border-ink text-sm text-mute`}>
              <tr className={trHeadClass}>
                <th
                  scope="col"
                  className={`${isAdmin ? "w-[22%]" : "w-[34%]"} whitespace-nowrap px-4 py-4 font-medium tracking-wider first:pl-0`}
                >
                  {t("columns.post")}
                </th>
                <th
                  scope="col"
                  className={`${isAdmin ? "w-[19%]" : "w-[26%]"} whitespace-nowrap px-4 py-4 font-medium tracking-wider`}
                >
                  {t("columns.name")}
                </th>
                <th
                  scope="col"
                  className={`${isAdmin ? "w-[21%]" : "w-[24%]"} whitespace-nowrap px-4 py-4 font-medium tracking-wider`}
                >
                  {t("columns.tenure")}
                </th>
                <th
                  scope="col"
                  className={`${isAdmin ? "w-[14%]" : "w-[16%]"} whitespace-nowrap px-4 py-4 font-medium tracking-wider`}
                >
                  {t("columns.source")}
                </th>
                {isAdmin ? (
                  <th
                    scope="col"
                    className="w-[24%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                  >
                    {t("columns.actions")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {detail.roster.map((row) => (
                <tr
                  key={row.id}
                  className={`${rowClass} border-b border-hairline hover:bg-row-hover`}
                >
                  <td
                    id={`roster-row-${row.id}`}
                    lang="ja"
                    className={`${postCellClass} px-4 py-4 text-body first:pl-0`}
                  >
                    {row.postName}
                  </td>
                  <td className={`${nameCellClass} px-4 py-4 text-lg font-medium`}>
                    <Link
                      href={`/persons/${row.personId}`}
                      className="link-inline inline-flex min-h-11 items-center"
                    >
                      {row.personName}
                    </Link>
                  </td>
                  <td className={`${tenureCellClass} px-4 py-4 text-sm text-mute`}>
                    {tenureText(row, formatDate, (key, values) => t(key, values))}
                  </td>
                  <td className={`${sourceCellClass} px-4 py-4`}>
                    {row.sourceUrl === "" ? (
                      <span className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-mute">
                        {t("noSource")}
                      </span>
                    ) : (
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
                    )}
                  </td>
                  {isAdmin ? (
                    <td className={`${actionsCellClass} px-4 py-2`}>
                      <RosterRowActions
                        cabinetId={detail.id}
                        appointmentId={row.id}
                        postName={row.postName}
                        personName={row.personName}
                        describedBy={`roster-row-${row.id}`}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
