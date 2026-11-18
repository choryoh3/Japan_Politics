---
description: スプリントの進捗と各スプリントの最新判定を一覧表示する
---

現在の進捗を報告する。ファイルは変更しない。

手順:
1. `docs/sprints/sprint-<数字>.md` を一覧し、各スプリントについて次を集める。
   - タイトル（見出し）と契約項目数
   - 最新判定: `python3 scripts/validate_docs.py --verdict <N>`（`PASS` / `FAIL` / `NONE`。`python3` が無ければ `python`）
   - 差し戻し回数: `docs/sprints/sprint-<N>-eval.md` 内の `VERDICT: FAIL` の数
2. `docs/progress.md` があれば、その「引き継ぎ事項」も読む。
3. 次の形式で簡潔に報告する。
   - 一覧表（Sprint / タイトル / 状態 / 差し戻し回数 / 最新判定）
   - 現在地（次に実行すべきコマンド。例: `/sprint 3`）
   - 未解決の課題・引き継ぎ事項
   - `docs/progress.md` と実際の判定が食い違っていれば、その指摘
