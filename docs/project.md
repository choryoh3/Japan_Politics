# プロジェクト設定

全エージェントとコマンドが最初に読む設定ファイル。`/init-project` で作成・更新する。
不要な項目は削除せず「なし」と書く（`scripts/validate_docs.py` が存在を検証する）。

## 基本

- プロジェクト名: japan-politics
- 種別: web-ui
- 一言説明: 歴代の日本の内閣・各省庁・自民党の人事を素早く検索・閲覧でき、ユーザーが作成・修正できる人事データベースアプリ

## 実行と検証

- 起動コマンド: pnpm dev（ルートで実行。モノレポ: apps/web = Next.js、packages/db = Drizzle スキーマ・マイグレーション・初期データ）
- URL: http://localhost:3000
- 停止方法: 起動したプロセスを kill（ポート 3000）
- 検証コマンド: pnpm test（Vitest）
- 静的検査コマンド: pnpm lint && pnpm typecheck（ESLint + Prettier の検査と TypeScript strict）
- ビルドコマンド: pnpm build
- 初期データ・準備: 次を順に実行する（`local.db` が無い状態から可。DB は `DATABASE_URL=file:./local.db`、未設定なら同じ値。相対パスはリポジトリのルート基準）。
  1. `pnpm install`
  2. `pnpm db:migrate`（DB の作成。未適用のマイグレーションだけ適用する）
  3. `pnpm db:seed`（菅内閣以降の実在の内閣・人物・閣僚人事を投入。何度実行しても件数は増えない）
  - 2 と 3 は `pnpm db:setup` で一度に実行できる。

## 評価

- UI評価: あり
- デザイン資料: docs/design/tokens.md
- 評価上の注意: 初期データは公式資料に基づく実在の人事（出典 URL 付き）。評価では、契約で指定した照合値・件数の下限・出典リンクを確認する。それ以外のデータの正確性は評価対象外。PlayStation 風デザイン（docs/design/DESIGN.md）のロゴ・商標・画像は使わない。UI の文言は日本語（next-intl の辞書経由）

## ハーネス設定（任意・既定値を変えるときだけ）

「契約で許可する語」には、契約に書いてよい実装寄りの語をカンマ区切りで書く（例: エンドポイント設計, useState）。

- 機能数: 2-4
- 契約項目数: 5-15
- 契約で許可する語: なし

## 使用 MCP

- playwright: web-ui の評価・デザイン確認（evaluator / designer）
- context7: ライブラリの最新ドキュメント確認（generator）
- serena: 既存コードのシンボル単位の探索・編集（generator、メインセッション）。技術スタックが決まったら `.serena/project.yml` の `language_servers` を合わせる
