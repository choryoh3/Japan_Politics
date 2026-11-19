import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MinistryTenureRow } from "@japan-politics/db";
import { CabinetName } from "@/components/cabinet-name";
import { EndDate, FormattedDate } from "@/components/formatted-date";

/**
 * 省庁ページの 1 つのタブぶんの表。歴代の在任者を、渡された順（就任日の新しい順）に出す。
 * 氏名は人物ページへ、内閣名は内閣詳細へのリンク。日本語の役職名・氏名・日付は行の途中で折れないようにする。
 * @param props.rows 在任者の行
 * @param props.tab どのタブか（表の読み上げ名に使う）
 */
export function MinistryHoldersTable({
  rows,
  tab,
}: {
  rows: readonly MinistryTenureRow[];
  tab: "minister" | "viceMinister" | "parliamentaryVice";
}) {
  const t = useTranslations("ministries");
  if (rows.length === 0) {
    return <p className="mt-6 rounded-card bg-surface-card p-8 text-body">{t("emptyTab")}</p>;
  }
  return (
    <div className="mt-6">
      {/* md 未満は 1 行ずつ縦に積む。md 以上は列幅固定の表 */}
      <table
        aria-label={t(`tableLabels.${tab}`)}
        className="block w-full border-collapse text-left md:table md:table-fixed"
      >
        <thead className="max-md:sr-only border-b border-ink text-sm text-mute md:table-header-group">
          <tr className="md:table-row">
            <th scope="col" className="w-[17%] whitespace-nowrap px-4 py-4 font-medium first:pl-0">
              {t("columns.name")}
            </th>
            <th scope="col" className="w-[23%] whitespace-nowrap px-4 py-4 font-medium">
              {t("columns.post")}
            </th>
            <th scope="col" className="w-[24%] whitespace-nowrap px-4 py-4 font-medium">
              {t("columns.cabinet")}
            </th>
            <th scope="col" className="w-[18%] whitespace-nowrap px-4 py-4 font-medium">
              {t("columns.startDate")}
            </th>
            <th scope="col" className="w-[18%] whitespace-nowrap px-4 py-4 font-medium">
              {t("columns.endDate")}
            </th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-hairline hover:bg-row-hover max-md:flex max-md:flex-wrap max-md:gap-x-6 max-md:py-4"
            >
              <td className="px-4 py-4 text-lg font-medium first:pl-0 max-md:w-full max-md:p-0">
                <Link
                  href={`/persons/${row.personId}`}
                  className="link-inline inline-flex min-h-11 items-center"
                >
                  {row.personName}
                </Link>
              </td>
              <td className="px-4 py-4 max-md:w-full max-md:p-0 max-md:text-sm max-md:text-mute">
                <span className="whitespace-nowrap">{row.postName}</span>
              </td>
              <td className="px-4 py-4 [word-break:keep-all] max-md:w-full max-md:p-0">
                <Link
                  href={`/cabinets/${row.cabinetId}`}
                  className="link-inline inline-flex min-h-11 items-center"
                >
                  <CabinetName name={row.cabinetName} />
                </Link>
              </td>
              <td
                data-label={t("columns.startDate")}
                className="px-4 py-4 tabular-nums md:max-lg:text-sm md:whitespace-nowrap max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
              >
                <FormattedDate date={row.startDate} />
              </td>
              <td
                data-label={t("columns.endDate")}
                className="px-4 py-4 tabular-nums md:max-lg:text-sm md:whitespace-nowrap max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
              >
                <EndDate date={row.endDate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
