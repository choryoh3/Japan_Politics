# プロジェクト設定

全エージェントとコマンドが最初に読む設定ファイル。`/init-project` で作成・更新する。
不要な項目は削除せず「なし」と書く（`scripts/validate_docs.py` が存在を検証する）。

## 基本

- プロジェクト名: （例: my-app）
- 種別: web-ui
- 一言説明: （何を作るか）

## 実行と検証

- 起動コマンド: （例: npm run dev）
- URL: （例: http://localhost:3000。web-ui / api のとき）
- 停止方法: （例: 起動したプロセスを kill。ポート番号も書く）
- 検証コマンド: （例: npm test）
- 静的検査コマンド: （例: npm run lint && npm run typecheck）
- ビルドコマンド: （例: npm run build）
- 初期データ・準備: （例: npm run seed。なければ「なし」）

## 評価

- UI評価: あり
- デザイン資料: docs/design/tokens.md
- 評価上の注意: （このプロダクト固有の評価ルール。例: 「サムネイル一覧のグリッド表示は減点しない」。なければ「なし」）

## ハーネス設定（任意・既定値を変えるときだけ）

「契約で許可する語」には、契約に書いてよい実装寄りの語をカンマ区切りで書く（例: エンドポイント設計, useState）。

- 機能数: 2-4
- 契約項目数: 5-15
- 契約で許可する語: なし

## 使用 MCP

- playwright: web-ui の評価・デザイン確認（evaluator / designer）
- context7: ライブラリの最新ドキュメント確認（generator）
- serena: 既存コードのシンボル単位の探索・編集（generator、メインセッション）。技術スタックが決まったら `.serena/project.yml` の `language_servers` を合わせる
