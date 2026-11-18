import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // DB パッケージは TypeScript のソースのまま配布しているので、Next.js にコンパイルしてもらう
  transpilePackages: ["@japan-politics/db"],
  // libSQL のネイティブモジュールはバンドルせず、実行時に読み込む
  serverExternalPackages: ["@libsql/client", "libsql"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
