---
description: リポジトリを調べて docs/project.md（種別・起動・検証コマンド）を作り、ハーネスを使える状態にする
argument-hint: [プロジェクトの一言説明（省略可）]
---

`CLAUDE.md` のワークフローの前提を整える。プロジェクト説明（省略可）: $ARGUMENTS

手順:
1. 既に `docs/project.md` がある場合は内容を読み、更新の要否だけを確認する（上書きしない）。
2. リポジトリを調べて、次を推定する（`package.json`、`pyproject.toml`、`Makefile`、`go.mod`、`Cargo.toml`、`README` など）。
   - 種別: web-ui / api / cli / library / other
   - 起動コマンド、URL・ポート、停止方法
   - 検証（テスト）・静的検査・ビルドの各コマンド
   - 空のリポジトリなら、推定できない項目は空欄にせず「未定（Sprint 1 で決める）」と書く
3. `docs/project.md` のテンプレート（`docs/project.md` の既存の形式）に従って書く。種別が web-ui なら「UI評価: あり」、それ以外は原則「なし」。
4. 推定した内容をユーザーに提示し、**間違い・不足を確認する**（特に種別、UI評価の有無、デザイン資料の有無）。
5. 種別が web-ui で `docs/design/tokens.md` が未整備なら、次のいずれかをユーザーに選んでもらう。
   - 資料（トークン・参考画像）を提供する
   - `designer` の「トークン草案モード」で草案を作り、ユーザーが承認する
   - 今回はデザイン工程を省略する（`UI評価: なし` にする。デザイン基準での採点は行われなくなる）
6. `python3 scripts/validate_docs.py docs/project.md` で検証する（`python3` が無ければ `python`）。
7. `CLAUDE.md` がプロジェクトルートに無ければ、ハーネス付属のテンプレートを置くことを提案する。
8. 完了したら、次の一手として `/kickoff <作りたいもの>` を案内する。
