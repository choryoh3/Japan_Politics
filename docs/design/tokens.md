# デザイントークン（デザインの正本）

web-ui プロジェクトで使う。designer と evaluator はこのファイルを唯一の基準にする。

## 正本

- 一次資料: [`docs/design/DESIGN.md`](./DESIGN.md)（`npx getdesign@latest add playstation` で取得した PlayStation 風デザインシステム。色・タイポグラフィ・余白・角丸・コンポーネント仕様を含む）
- 実装では、DESIGN.md の値を Tailwind CSS のテーマ（CSS 変数）と shadcn/ui のテーマに写して使う。値を直書きしない。
- 色や寸法で迷ったら DESIGN.md を優先する。DESIGN.md を変えるときはユーザーの承認を得る。

## 本プロジェクトでの補足

- 独自フォント（PlayStation SST）は使えない。Web フォント（例: Noto Sans JP + 近い見た目の欧文フォント。`next/font` で読み込む）に置き換え、見出しの軽いウェイト（300）の雰囲気は保つ。
- 日本語の文言は next-intl の辞書で管理する。可読性のため、日本語本文の行間は DESIGN.md の値より広め（1.7 前後）にしてよい。
- ライト / ダークの両キャンバスを DESIGN.md のトークンで切り替えられるようにする。
- DESIGN.md の画像・ロゴ・商標（PlayStation のロゴなど）は使わない。雰囲気と構造だけを参考にする。
