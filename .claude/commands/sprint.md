---
description: 指定スプリントを generator → (designer) → evaluator で実装・評価し、差し戻しルールに従って完了させる
argument-hint: <スプリント番号>
---

`CLAUDE.md` のワークフローと差し戻しルールに厳密に従い、Sprint $ARGUMENTS を実行する。

## 事前確認（満たさなければ中断してユーザーに報告する）

- `docs/project.md` が存在し、`python3 scripts/validate_docs.py docs/project.md` を通ること（`python3` が無ければ `python`）
- `docs/sprints/sprint-$ARGUMENTS.md` が存在し、`python3 scripts/validate_docs.py docs/sprints/sprint-$ARGUMENTS.md` を通ること
- 前のスプリントがある場合、`python3 scripts/validate_docs.py --verdict <前の番号>` が `PASS` を返すこと
- `docs/project.md` の `UI評価` が「あり」の場合、`docs/design/tokens.md` が存在し内容があること（無ければユーザーに資料の提供、または `designer` の「トークン草案モード」を依頼する）
- `git status` で未コミットの変更を確認し、あればユーザーに伝える（スプリントの差分を後で見分けやすくするため、コミットを勧める。勝手にコミットしない）

## 手順

1. **generator**: 契約ファイルのパス、スプリント番号、`docs/project.md`、前スプリントの引き継ぎ事項（未通過・既知の制限・提案）を渡して呼ぶ。完了報告を **原文のまま** 保持する。
   - 「未通過」の項目があれば、その時点でユーザーに報告するか、`generator` を呼び直して解消する（差し戻し回数には数えない。ただし1回まで）。
   - 完了報告に「契約が矛盾・不明確」とあれば、`/replan` の手順（planner に契約修正を依頼し、ユーザーの承認を得る）に移る。
2. **品質ゲート**: メインセッションが `docs/project.md` の静的検査・検証（テスト）・ビルドの各コマンドを自分で実行する（「なし」は省略）。失敗したら、出力を原文で添えて `generator` を呼び直す（差し戻し回数には数えない。ただし1回まで）。
3. **designer**（`UI評価: あり` のときだけ）: `generator` の完了報告を原文のまま添えて呼ぶ。`UI評価: なし` のときはこの工程を飛ばす。
4. **アプリ起動**: `docs/project.md` の起動コマンドで起動し、URL（または CLI の動作）が応答することを確認する。起動できなければ評価に進まず、ユーザーに報告する。
5. **evaluator**: 契約ファイルのパス、URL（または実行方法）、スプリント番号、試行番号、`docs/project.md`、前回不合格の項目（再評価のとき）を渡して呼ぶ。
6. **判定の保存**: evaluator の出力を **原文のまま** `docs/sprints/sprint-$ARGUMENTS-eval.md` に保存する（2回目以降は区切り線 `---` と `## 試行 K` の見出しを付けて追記）。保存後、`python3 scripts/validate_docs.py --verdict $ARGUMENTS` で判定を読む。
7. **判定の処理**:
   - `PASS` → 完了。手順 9 へ。
   - `FAIL` → evaluator の `RETURN_TO` に従い、**その担当だけ** を、evaluator のフィードバックを原文のまま添えて呼び直す。
     - `generator` → 修正後、品質ゲート → `designer`（UI評価ありのとき）→ アプリ再起動 → `evaluator` の順で再評価する
     - `designer` → 修正後、`evaluator` で再評価する
     - `planner` → `/replan` の手順に移る（ユーザーの承認が必要）
     - `none`（評価環境の問題）→ 環境を直して再評価する（差し戻し回数には数えない）
   - 判定をメインセッションの判断で覆さない。
8. **差し戻しは最大3回。** 3回目も不合格ならループを止め、未解決の項目と原因の見立てをユーザーに報告して判断を仰ぐ。
9. **終了処理**: 起動したアプリのプロセスを停止する。`docs/progress.md` を更新する。結果（合格/中断、差し戻し回数、残課題、次のスプリントへの引き継ぎ事項）を簡潔に報告する。

## docs/progress.md の形式

```markdown
# 進捗

| Sprint | タイトル | 状態 | 差し戻し | 最新判定 | メモ |
|---|---|---|---|---|---|
| 1 | ... | 合格 | 1 | PASS | |
| 2 | ... | 進行中 | 0 | - | |
| 3 | ... | 未着手 | - | - | |

## 引き継ぎ事項
- （既知の制限、evaluator の改善提案、未解決の課題）
```
