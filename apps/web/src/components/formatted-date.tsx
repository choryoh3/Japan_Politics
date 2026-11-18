import { useTranslations } from "next-intl";
import { parseIsoDate } from "@/lib/date";

/**
 * 「YYYY-MM-DD」を「2020年9月16日」の形で表示する。
 * @param props.date 「YYYY-MM-DD」形式の日付。形式が不正ならそのまま表示する
 */
export function FormattedDate({ date }: { date: string }) {
  const t = useTranslations("common");
  const parts = parseIsoDate(date);
  return <time dateTime={date}>{parts ? t("dateFormat", parts) : date}</time>;
}

/**
 * 終了日を表示する。null（まだ終わっていない）なら「現在」と表示する。
 * @param props.date 終了日。null なら現在
 */
export function EndDate({ date }: { date: string | null }) {
  const t = useTranslations("common");
  return date === null ? (
    <span className="inline-flex items-center rounded-full border border-link px-3 text-sm font-medium text-link">
      {t("current")}
    </span>
  ) : (
    <FormattedDate date={date} />
  );
}
