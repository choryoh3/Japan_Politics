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
      <h1 className="text-[32px] font-light leading-tight tracking-tight md:text-display-xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-[40em] text-base text-body md:text-lg">{t("description")}</p>
      {cabinets.length === 0 ? (
        <p className="mt-12 rounded-card bg-surface-card p-8 text-body">{t("empty")}</p>
      ) : (
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="border-b border-ink text-sm text-mute">
              <tr>
                <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                  {t("columns.name")}
                </th>
                <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                  {t("columns.primeMinister")}
                </th>
                <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                  {t("columns.startDate")}
                </th>
                <th scope="col" className="px-4 py-4 font-medium tracking-wider first:pl-0">
                  {t("columns.endDate")}
                </th>
              </tr>
            </thead>
            <tbody>
              {cabinets.map((cabinet) => (
                <tr key={cabinet.id} className="border-b border-hairline hover:bg-row-hover">
                  <td className="px-4 py-4 first:pl-0">
                    <Link
                      href={`/cabinets/${cabinet.id}`}
                      className="link-inline inline-flex min-h-11 items-center text-lg font-medium"
                    >
                      {cabinet.name}
                    </Link>
                  </td>
                  <td className="px-4 py-4 first:pl-0">{cabinet.primeMinisterName}</td>
                  <td className="px-4 py-4 first:pl-0">
                    <FormattedDate date={cabinet.startDate} />
                  </td>
                  <td className="px-4 py-4 first:pl-0">
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
