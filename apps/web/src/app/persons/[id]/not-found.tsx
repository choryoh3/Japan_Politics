import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * 存在しない人物を開いたときの画面。一覧へ戻るリンクを出す。
 */
export default async function PersonNotFound() {
  const t = await getTranslations("personDetail");
  const tc = await getTranslations("common");
  return (
    <div>
      <h1 className="text-[32px] font-light leading-tight [word-break:auto-phrase] md:text-display-xl">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-4 max-w-[40em] text-body [word-break:auto-phrase]">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center rounded-full bg-primary px-7 text-base font-bold tracking-wider text-on-dark hover:bg-primary-pressed"
      >
        {tc("backToList")}
      </Link>
    </div>
  );
}
