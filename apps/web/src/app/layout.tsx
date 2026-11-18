import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";
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
 * 全ページ共通のレイアウト。html の lang とヘッダー、文言の提供元を用意する。
 * @param props.children 各ページの中身
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html lang={locale} className={notoSansJp.variable}>
      <body>
        <NextIntlClientProvider>
          <header className="bg-canvas-dark text-on-dark">
            <div className="mx-auto flex h-12 max-w-7xl items-center px-6 text-lg font-medium tracking-wider md:px-12">
              {t("appName")}
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
