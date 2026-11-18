import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listCabinets } from "@japan-politics/db";
import { EndDate, FormattedDate } from "@/components/formatted-date";
import { getDb } from "@/lib/db";

// 毎回 DB から読む（ビルド時に DB を要求しない）
export const dynamic = "force-dynamic";

/**
 * トップページ。歴代内閣を発足日の新しい順に一覧表示する。
 */
export default async function HomePage() {
  const t = await getTranslations("cabinets");
  const cabinets = await listCabinets(getDb());

  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight tracking-tight [text-wrap:balance] md:text-display-xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-[40em] text-base text-body md:text-lg">{t("description")}</p>
      {cabinets.length === 0 ? (
        <p className="mt-12 rounded-card bg-surface-card p-8 text-body">{t("empty")}</p>
      ) : (
        <div className="mt-12">
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
                  {t("columns.name")}
                </th>
                <th
                  scope="col"
                  className="w-[26%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                >
                  {t("columns.primeMinister")}
                </th>
                <th
                  scope="col"
                  className="w-[20%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                >
                  {t("columns.startDate")}
                </th>
                <th
                  scope="col"
                  className="w-[20%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                >
                  {t("columns.endDate")}
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {cabinets.map((cabinet) => (
                <tr
                  key={cabinet.id}
                  className="border-b border-hairline hover:bg-row-hover max-md:flex max-md:flex-wrap max-md:gap-x-6 max-md:py-4"
                >
                  <td className="px-4 py-4 first:pl-0 max-md:w-full max-md:p-0">
                    <Link
                      href={`/cabinets/${cabinet.id}`}
                      className="link-inline inline-flex min-h-11 items-center text-lg font-medium"
                    >
                      {cabinet.name}
                    </Link>
                  </td>
                  <td
                    data-label={t("columns.primeMinister")}
                    className="px-4 py-4 max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)] max-md:w-full"
                  >
                    {cabinet.primeMinisterName}
                  </td>
                  <td
                    data-label={t("columns.startDate")}
                    className="px-4 py-4 max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
                  >
                    <FormattedDate date={cabinet.startDate} />
                  </td>
                  <td
                    data-label={t("columns.endDate")}
                    className="px-4 py-4 max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
                  >
                    <EndDate date={cabinet.endDate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
