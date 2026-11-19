import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listMinistries } from "@japan-politics/db";
import { getDb } from "@/lib/db";

// 毎回 DB から読む（ビルド時に DB を要求しない）
export const dynamic = "force-dynamic";

/**
 * 省庁一覧ページ。現行の府省（内閣府・デジタル庁・復興庁と 11 省）を一覧し、各省庁ページへのリンクを出す。
 */
export default async function MinistriesPage() {
  const t = await getTranslations("ministries");
  const items = await listMinistries(getDb());

  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight tracking-tight [text-wrap:balance] [word-break:auto-phrase] md:text-display-xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-[40em] text-base text-body [word-break:auto-phrase] md:text-lg">
        {t("description")}
      </p>
      {items.length === 0 ? (
        <p className="mt-12 rounded-card bg-surface-card p-8 text-body">{t("empty")}</p>
      ) : (
        <ul
          aria-label={t("listLabel")}
          className="mt-12 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((item) => (
            <li key={item.id} className="border-b border-hairline">
              <Link
                href={`/ministries/${item.id}`}
                className="link-inline flex min-h-14 items-center whitespace-nowrap text-lg font-medium"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
