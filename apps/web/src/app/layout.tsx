import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

/**
 * 最初の描画の前に、保存済みの配色を html に反映する小さなスクリプト。
 * 描画後に反映すると、一瞬だけ別の配色が見えてしまうため、head で先に実行する。
 */
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

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
 * 全ページ共通のレイアウト。html の lang とヘッダー、文言の提供元を用意する。
 * @param props.children 各ページの中身
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html lang={locale} className={notoSansJp.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <header className="border-b border-hairline-dark bg-canvas-dark text-on-dark">
            <div className="relative mx-auto flex min-h-12 max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 md:gap-x-6 md:px-12 md:py-2">
              <Link
                href="/"
                className="flex min-h-11 w-full shrink-0 items-center text-lg font-medium tracking-wider text-on-dark md:mr-auto md:w-auto"
              >
                {t("appName")}
              </Link>
              <SearchBox />
              <ThemeToggle />
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
