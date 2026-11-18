import { getRequestConfig } from "next-intl/server";

/**
 * next-intl のリクエスト設定。今は日本語のみなので、ロケールは固定する。
 * @returns ロケールと、その言語の文言辞書
 */
export default getRequestConfig(async () => {
  const locale = "ja";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
