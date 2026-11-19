import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { postCategory, type PostCategory, type RosterRow } from "@japan-politics/db";
import { RosterRowActions } from "@/components/roster-row-actions";
import { parseIsoDate } from "@/lib/date";

/**
 * 人事 1 行ぶんの在任期間の文言を作る（途中交代のときだけ値がある）。
 * @param row 名簿の行
 * @param formatDate 「YYYY-MM-DD」を表示用に直す関数
 * @param t 辞書
 * @returns 在任期間の表示。内閣の期間どおりなら null
 */
function tenureText(
  row: RosterRow,
  formatDate: (iso: string) => string,
  t: (key: "tenureFrom" | "tenureUntil", values: Record<string, string>) => string,
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
  // 日付が 1 つだけでも折り返さない span にして、「ま／で」「か／ら」のような 1 文字だけの折れを防ぐ
  if (row.startDate) {
    return (
      <span className="whitespace-nowrap">
        {t("tenureFrom", { date: formatDate(row.startDate) })}
      </span>
    );
  }
  if (row.endDate) {
    return (
      <span className="whitespace-nowrap">
        {t("tenureUntil", { date: formatDate(row.endDate) })}
      </span>
    );
  }
  return null;
}

/**
 * 内閣詳細の 1 区分ぶんの名簿の表（役職・氏名・在任・出典、管理者には操作の列も）。
 * 4 つの区分（閣僚・内閣官房副長官・副大臣・大臣政務官）で同じ作りの表を使う。
 * @param props.cabinetId 内閣 ID（管理者の操作用）
 * @param props.rows この区分の人事（表示順に並んだもの）
 * @param props.category 区分（表の読み上げ名と、削除ダイアログの文言に使う）
 * @param props.isAdmin 管理者か。管理者だけ「操作」の列を出す
 */
export function RosterTable({
  cabinetId,
  rows,
  category,
  isAdmin,
}: {
  cabinetId: number;
  rows: readonly RosterRow[];
  category: PostCategory;
  isAdmin: boolean;
}) {
  const t = useTranslations("cabinetDetail");
  const tc = useTranslations("common");
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
  const sourceCellClass = isAdmin ? "max-lg:w-full max-lg:p-0" : "max-md:p-0";
  const actionsCellClass = "lg:whitespace-nowrap max-lg:w-full max-lg:p-0";

  return (
    <div className="mt-6">
      {/* 一般は md 以上、管理者（5 列で幅が要る）は lg 以上が列幅固定の表。それ未満は 1 行ずつ縦に積む（横スクロールに頼らない） */}
      <table
        aria-label={t(`tableLabels.${category}`)}
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
          {rows.map((row) => (
            <tr key={row.id} className={`${rowClass} border-b border-hairline hover:bg-row-hover`}>
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
                  className="link-inline inline-flex min-h-11 max-w-full items-center"
                >
                  {/* 空白のない長い氏名だけが、セルの幅で折り返す（普通の氏名は折れない） */}
                  <span className="min-w-0 [overflow-wrap:anywhere]">{row.personName}</span>
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
                    cabinetId={cabinetId}
                    appointmentId={row.id}
                    postName={row.postName}
                    personName={row.personName}
                    isMinister={postCategory(row.postName) === "minister"}
                    describedBy={`roster-row-${row.id}`}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
