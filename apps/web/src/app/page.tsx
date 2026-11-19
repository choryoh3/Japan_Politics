import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listCabinets } from "@japan-politics/db";
import { CabinetName } from "@/components/cabinet-name";
import { EndDate, FormattedDate } from "@/components/formatted-date";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SECONDARY_BUTTON_CLASS } from "@/lib/ui-classes";

// 毎回 DB から読む（ビルド時に DB を要求しない）
export const dynamic = "force-dynamic";

/**
 * トップページ。歴代内閣を発足日の新しい順に一覧表示する。
 */
export default async function HomePage() {
  const t = await getTranslations("cabinets");
  const cabinets = await listCabinets(getDb());
  // 「内閣を追加」は管理者にだけ描画する（権限の最終確認は API が行う）
  const isAdmin = (await getCurrentUser())?.role === "admin";

  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight tracking-tight [text-wrap:balance] [word-break:auto-phrase] md:text-display-xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-[40em] text-base text-body [word-break:auto-phrase] md:text-lg">
        {t("description")}
      </p>
      {isAdmin ? (
        <div className="mt-6">
          <Link href="/cabinets/new" className={SECONDARY_BUTTON_CLASS}>
            {t("add")}
          </Link>
        </div>
      ) : null}
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
                  className="w-[30%] whitespace-nowrap px-4 py-4 font-medium tracking-wider first:pl-0"
                >
                  {t("columns.name")}
                </th>
                <th
                  scope="col"
                  className="w-[24%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                >
                  {t("columns.primeMinister")}
                </th>
                <th
                  scope="col"
                  className="w-[23%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                >
                  {t("columns.startDate")}
                </th>
                <th
                  scope="col"
                  className="w-[23%] whitespace-nowrap px-4 py-4 font-medium tracking-wider"
                >
                  {t("columns.endDate")}
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {cabinets.map((cabinet, index) => (
                <tr
                  key={cabinet.id}
                  className={
                    index === 0
                      ? // 現在の内閣は青の「章」として帯にし、下の歴代の行と段差をつける
                        "bg-primary text-on-dark max-md:flex max-md:flex-wrap max-md:gap-x-6 max-md:px-4 max-md:py-6 [&_span]:border-on-dark [&_span]:text-on-dark [&_td]:before:text-on-dark [&_td]:before:font-light [&_td]:py-8 max-md:[&_td]:py-0 md:[&_td:first-child]:pl-4"
                      : "border-b border-hairline hover:bg-row-hover max-md:flex max-md:flex-wrap max-md:gap-x-6 max-md:py-4"
                  }
                >
                  <td className="px-4 py-4 first:pl-0 max-md:w-full max-md:p-0">
                    <Link
                      href={`/cabinets/${cabinet.id}`}
                      className={`link-inline inline-flex min-h-11 items-center font-medium ${
                        index === 0
                          ? "text-heading-lg !text-on-dark underline lg:text-heading-xl"
                          : "text-lg"
                      }`}
                    >
                      <CabinetName name={cabinet.name} />
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
                    className="px-4 py-4 tabular-nums md:whitespace-nowrap max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
                  >
                    <FormattedDate date={cabinet.startDate} />
                  </td>
                  <td
                    data-label={t("columns.endDate")}
                    className="px-4 py-4 tabular-nums md:whitespace-nowrap max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
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
