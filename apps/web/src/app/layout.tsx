import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";
import { AuthNav } from "@/components/auth-nav";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE_NAME, parseTheme } from "@/lib/theme";
import "./globals.css";

// DESIGN.md の細い見出し（300）から太いボタン（700）までを使う
const notoSansJp = Noto_Sans_JP({
  weight: ["300", "400", "500", "700"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

/**
 * ページ共通のメタ情報（タイトル）を作る。文言は辞書から取る。
 * @returns メタデータ
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("appName") };
}

/**
 * 全ページ共通のレイアウト（cookie を読むため、全ページが動的に描画される）。html の lang とヘッダー、文言の提供元を用意する。
 * @param props.children 各ページの中身
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  // 配色はサーバーが cookie から決めて、最初の HTML に入れる。
  // インラインスクリプトは not-found などクライアントで組み立てられる画面で実行されないため使わない。
  // 選択が無ければ undefined になり、属性が付かず OS の設定に従う。
  const theme = parseTheme((await cookies()).get(THEME_COOKIE_NAME)?.value);
  return (
    <html lang={locale} className={notoSansJp.variable} data-theme={theme} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <header className="border-b border-hairline-dark bg-canvas-dark text-on-dark">
            <div className="relative mx-auto flex min-h-12 max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 md:gap-x-4 lg:gap-x-6 md:px-12 md:py-2">
              <Link
                href="/"
                className="flex min-h-11 w-full shrink-0 items-center text-lg font-medium tracking-wider text-on-dark md:mr-auto md:w-auto"
              >
                {t("appName")}
              </Link>
              <SearchBox />
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-1 md:flex-nowrap md:gap-x-4">
                <AuthNav />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 pb-16 pt-12 md:px-12 md:pb-section md:pt-16">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
