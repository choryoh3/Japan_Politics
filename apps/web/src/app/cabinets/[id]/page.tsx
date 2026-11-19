import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getCabinetDetail,
  POST_CATEGORIES,
  postCategory,
  type PostCategory,
  type RosterRow,
} from "@japan-politics/db";
import { CabinetName } from "@/components/cabinet-name";
import { EndDate, FormattedDate } from "@/components/formatted-date";
import { RosterTable } from "@/components/roster-table";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SECONDARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { parseCabinetId } from "@/lib/cabinet-id";

export const dynamic = "force-dynamic";

/**
 * 内閣詳細ページ。内閣名・在任期間と、4 つの区分（閣僚・内閣官房副長官・副大臣・大臣政務官）の名簿（出典リンク付き）を表示する。
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
  const tp = await getTranslations("postCategories");

  // 区分ごとに、名簿の表示順のまま振り分ける（一覧にない役職は閣僚として扱う）
  const rowsByCategory = new Map<PostCategory, RosterRow[]>(
    POST_CATEGORIES.map((category) => [category, []]),
  );
  for (const row of detail.roster) rowsByCategory.get(postCategory(row.postName))?.push(row);

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
          <Link
            href={`/cabinets/${detail.id}/appointments/new?category=minister`}
            className={SECONDARY_BUTTON_CLASS}
          >
            {t("addAppointment")}
          </Link>
          <Link href={`/cabinets/${detail.id}/appointments/new`} className={SECONDARY_BUTTON_CLASS}>
            {t("addPost")}
          </Link>
        </div>
      ) : null}

      {POST_CATEGORIES.map((category) => {
        const rows = rowsByCategory.get(category) ?? [];
        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <h2
              id={`category-${category}`}
              className="mt-12 text-heading-lg font-light tracking-wide md:text-heading-xl"
            >
              {tp(category)}
            </h2>
            {rows.length === 0 ? (
              <p className="mt-6 rounded-card bg-surface-card p-8 text-body">
                {category === "minister" ? t("empty") : t("emptyCategory")}
              </p>
            ) : (
              <RosterTable
                cabinetId={detail.id}
                rows={rows}
                category={category}
                isAdmin={isAdmin}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
