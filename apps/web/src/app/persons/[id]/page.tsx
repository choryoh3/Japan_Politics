import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPersonProfile } from "@japan-politics/db";
import { PersonAdminActions } from "@/components/person-admin-actions";
import { CabinetName } from "@/components/cabinet-name";
import { EndDate, FormattedDate } from "@/components/formatted-date";
import { parseCabinetId } from "@/lib/cabinet-id";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 人物ページ。氏名・よみがなと、就任したすべての役職の経歴（出典つき）を就任日の新しい順に表示する。
 * @param props.params URL の動的部分（人物 ID）
 */
export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 人物 ID も「1 以上の整数」だけを受け付ける（内閣 ID と同じ形式）
  const personId = parseCabinetId(id);
  if (personId === null) notFound();

  const profile = await getPersonProfile(getDb(), personId);
  if (!profile) notFound();

  const current = await getCurrentUser();
  const t = await getTranslations("personDetail");
  const tc = await getTranslations("common");

  return (
    <div>
      {/* 章の帯: 内閣詳細と同じ、画面いっぱいの青地（影ではなく疑似要素で幅を広げ、横スクロールを出さない） */}
      <section className="on-primary relative isolate -mt-12 px-0 pb-12 pt-6 text-on-dark before:absolute before:inset-y-0 before:-left-[100vmax] before:-right-[100vmax] before:-z-10 before:bg-primary [clip-path:inset(0_-100vmax)] md:-mt-16 md:pb-16">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-on-dark underline underline-offset-4 hover:no-underline"
        >
          {tc("backToList")}
        </Link>
        <h1 className="mt-6 text-[32px] font-light leading-tight tracking-tight [overflow-wrap:anywhere] [text-wrap:balance] md:text-display-xl">
          {profile.name}
        </h1>
        <p className="mt-2 border-t border-on-dark/40 pt-4 text-lg font-light text-on-dark">
          <span className="sr-only">{t("kanaLabel")}: </span>
          {profile.kana}
        </p>
        {profile.birthDate ? (
          <p className="mt-2 text-base font-light text-on-dark">
            {t("birthDate")}: <FormattedDate date={profile.birthDate} />
          </p>
        ) : null}
        {profile.memo ? (
          <p className="mt-2 whitespace-pre-wrap text-base font-light text-on-dark">
            <span className="sr-only">{t("memoLabel")}: </span>
            {profile.memo}
          </p>
        ) : null}
      </section>

      {current?.role === "admin" ? (
        <PersonAdminActions personId={profile.id} personName={profile.name} />
      ) : null}

      <h2 className="mt-12 text-heading-lg font-light tracking-wide md:text-heading-xl">
        {t("careerTitle")}
      </h2>
      {profile.careers.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface-card p-8 text-body">{t("empty")}</p>
      ) : (
        <div className="mt-6">
          {/* md 未満は 1 行ずつ縦に積む。md 以上は列幅固定の表 */}
          <table
            aria-label={t("tableLabel")}
            className="block w-full border-collapse text-left md:table md:table-fixed"
          >
            <thead className="max-md:sr-only border-b border-ink text-sm text-mute md:table-header-group">
              <tr className="md:table-row">
                <th scope="col" className="w-[27%] px-4 py-4 font-medium first:pl-0 lg:w-[22%]">
                  {t("columns.post")}
                </th>
                <th scope="col" className="w-[20%] px-4 py-4 font-medium lg:w-[22%]">
                  {t("columns.cabinet")}
                </th>
                <th
                  scope="col"
                  className="w-[20%] whitespace-nowrap px-4 py-4 font-medium md:max-lg:px-2 lg:w-[18%]"
                >
                  {t("columns.startDate")}
                </th>
                <th
                  scope="col"
                  className="w-[20%] whitespace-nowrap px-4 py-4 font-medium md:max-lg:px-2 lg:w-[18%]"
                >
                  {t("columns.endDate")}
                </th>
                <th
                  scope="col"
                  className="w-[13%] whitespace-nowrap px-4 py-4 font-medium lg:w-[20%]"
                >
                  {t("columns.source")}
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {profile.careers.map((career) => (
                <tr
                  key={career.id}
                  className="border-b border-hairline hover:bg-row-hover max-md:flex max-md:flex-wrap max-md:gap-x-6 max-md:py-4"
                >
                  <td className="px-4 py-4 text-lg font-medium [text-wrap:pretty] first:pl-0 md:max-lg:text-base max-md:w-full max-md:p-0">
                    {career.postName}
                  </td>
                  <td className="px-4 py-4 [word-break:keep-all] md:max-lg:text-sm max-md:w-full max-md:p-0">
                    <Link
                      href={`/cabinets/${career.cabinetId}`}
                      className="link-inline inline-flex min-h-11 items-center"
                    >
                      <CabinetName name={career.cabinetName} />
                    </Link>
                  </td>
                  <td
                    data-label={t("columns.startDate")}
                    className="px-4 py-4 tabular-nums md:max-lg:px-2 md:max-lg:text-sm md:whitespace-nowrap max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
                  >
                    <FormattedDate date={career.startDate} />
                  </td>
                  <td
                    data-label={t("columns.endDate")}
                    className="px-4 py-4 tabular-nums md:max-lg:px-2 md:max-lg:text-sm md:whitespace-nowrap max-md:w-full max-md:p-0 max-md:text-sm max-md:before:mr-2 max-md:before:text-mute max-md:before:content-[attr(data-label)]"
                  >
                    <EndDate date={career.endDate} />
                  </td>
                  <td className="px-4 py-4 max-md:w-full max-md:p-0">
                    {career.sourceUrl === "" ? (
                      <span className="inline-flex min-h-11 items-center text-sm text-mute">
                        {t("noSource")}
                      </span>
                    ) : (
                      <a
                        href={career.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={career.sourceNote}
                        aria-label={t("sourceLabel", { post: career.postName })}
                        className="link-inline inline-flex min-h-11 items-center whitespace-nowrap"
                      >
                        {tc("source")}
                      </a>
                    )}
                    {/* 出典メモは画面にも出す（根拠の確認状況を、リンクを開かなくても読めるように） */}
                    {career.sourceNote !== "" ? (
                      <p
                        title={career.sourceNote}
                        className="whitespace-pre-wrap text-sm text-mute [overflow-wrap:anywhere] md:line-clamp-2"
                      >
                        {career.sourceNote}
                      </p>
                    ) : null}
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
