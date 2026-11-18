# プロジェクト設定

全エージェントとコマンドが最初に読む設定ファイル。`/init-project` で作成・更新する。
不要な項目は削除せず「なし」と書く（`scripts/validate_docs.py` が存在を検証する）。

## 基本

- プロジェクト名: japan-politics
- 種別: web-ui
- 一言説明: 歴代の日本の内閣・各省庁・自民党の人事を素早く検索・閲覧でき、ユーザーが作成・修正できる人事データベースアプリ

## 実行と検証

- 起動コマンド: pnpm dev（ルートで実行。モノレポの構成は Sprint 1 で決める）
- URL: http://localhost:3000
- 停止方法: 起動したプロセスを kill（ポート 3000）
- 検証コマンド: pnpm test（Vitest）
- 静的検査コマンド: pnpm lint && pnpm typecheck（ESLint + Prettier の検査と TypeScript strict）
- ビルドコマンド: pnpm build
- 初期データ・準備: pnpm install。DB は DATABASE_URL=file:./local.db（ファイル DB）。マイグレーションと初期データ投入のコマンドは未定（Sprint 1 で決める）

## 評価

- UI評価: あり
- デザイン資料: docs/design/tokens.md
- 評価上の注意: 初期データは実在の人事とは限らない（検証用データ）。実在の人物名を扱うため、データの正確性そのものではなく、閲覧・検索・作成・修正の動作と画面の質で評価する。PlayStation 風デザイン（docs/design/DESIGN.md）のロゴ・商標・画像は使わない。UI の文言は日本語（next-intl の辞書経由）

## ハーネス設定（任意・既定値を変えるときだけ）

「契約で許可する語」には、契約に書いてよい実装寄りの語をカンマ区切りで書く（例: エンドポイント設計, useState）。

- 機能数: 2-4
- 契約項目数: 5-15
- 契約で許可する語: なし

## 使用 MCP

- playwright: web-ui の評価・デザイン確認（evaluator / designer）
- context7: ライブラリの最新ドキュメント確認（generator）
- serena: 既存コードのシンボル単位の探索・編集（generator、メインセッション）。技術スタックが決まったら `.serena/project.yml` の `language_servers` を合わせる
