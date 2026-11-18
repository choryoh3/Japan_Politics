# 汎用マルチエージェント・ハーネス

短い依頼から、仕様書 → スプリント契約 → 実装 → デザイン → 実操作による評価までを、4 つのサブエージェントで回すための一式。
プロジェクトの種類（web-ui / api / cli / library）を問わず使える。

## 中身

```
.common/
├── CLAUDE.md                 オーケストレーションのルール（ルートに置く）
├── .mcp.json                 Playwright / Context7
├── .claude/
│   ├── agents/               planner / generator / designer / evaluator
│   ├── commands/             /init-project /kickoff /sprint /status /replan
│   └── settings.json         権限（.env 保護、force push 禁止など）とフック
├── scripts/validate_docs.py  ドキュメントの機械検証
├── .github/workflows/        CI（validate-docs.yml）
└── docs/
    ├── project.md            プロジェクト設定のテンプレート
    └── design/tokens.md      デザイントークンのテンプレート
```

## 導入手順

1. `.common/` の中身を、対象プロジェクトのルートへコピーする（`.common` フォルダ自体ではなく、その中身）。
   ```
   cp -r .common/. /path/to/your-project/
   ```
   既に `CLAUDE.md` / `.mcp.json` / `.claude/settings.json` がある場合は、上書きせず内容を統合する。
2. 前提を確認する: Python 3、Node.js（`npx`）。Windows では、`python` / `python3` が Microsoft Store のスタブ（実体なし）になっていることがある。`python3 -c "print(1)"` で実際に動くか確認し、動かなければ Python をインストールする（動かないとフックと CI の検証が働かない。フックは警告を出すだけで止まらない）。
3. Claude Code を起動し、`/mcp` で Context7 を OAuth 認証する。Playwright は初回の有効化を承認する。
4. `/init-project` を実行して `docs/project.md` を作る。
5. web-ui なら `docs/design/tokens.md` を埋める（またはデザイン資料を提供する）。
6. `/kickoff <作りたいもの>` → 承認 → `/sprint 1` → `/sprint 2` …

## 設計の要点

- **オーケストレーターはメインセッション。** サブエージェントは会話履歴を持たないため、契約ファイルのパス・前段の報告・スプリント番号を毎回渡す。
- **生成と評価を分ける。** 実装者は自己採点せず、`evaluator` が実際に動かして判定する。判定は `VERDICT: PASS|FAIL` / `RETURN_TO:` で機械的に読める。
- **契約は検証可能に。** `scripts/validate_docs.py` が、曖昧な表現・実装詳細・先送りを含む契約、機能数・項目数の逸脱を、書いた瞬間にフックで差し戻す。
- **種別に応じて工程が変わる。** `UI評価: なし`（api / cli / library）では `designer` とデザイン採点を省略し、`evaluator` は curl・CLI 実行・検証コードで確かめる。
- **品質ゲート。** evaluator の前に、静的検査・テスト・ビルドをメインセッションが実行する。
- **回帰確認。** evaluator は前スプリントの主要項目も再テストする。
- **差し戻しは最大 3 回。** 超えたらユーザーに判断を仰ぐ。

## カスタマイズ

| 目的 | 場所 |
|---|---|
| モデルの変更 | `.claude/agents/*.md` の `model:`（既定: planner / evaluator = opus、generator / designer = sonnet） |
| 機能数・契約項目数の閾値 | `docs/project.md` の「ハーネス設定」 |
| 契約に書いてよい実装寄りの語 | `docs/project.md` の「契約で許可する語」 |
| プロダクト固有の評価の例外 | `docs/project.md` の「評価上の注意」 |
| デザインの採点閾値 | `.claude/agents/evaluator.md` の表 |
| 禁止・確認するコマンド | `.claude/settings.json` の `permissions` |
| MCP の追加（DB・決済など） | `.mcp.json`、担当エージェントの `tools` / `mcpServers`、`CLAUDE.md` の役割表 |

## 注意

- `evaluator` は `Bash` を持つ（api / cli / library の検証に必要）。書き込みの禁止は、ツール制限ではなくエージェント定義の規律で担保している。厳密に縛りたい場合は `settings.json` の `permissions` で個別に deny する。
- 書き込み権限を持つ MCP（DB・決済）を追加するときは、開発用・テスト用の接続先に限定し、認証情報はシェルの環境変数か OAuth にして、ファイルに書かない。
- `scripts/validate_docs.py` の検証対象は `docs/` 配下の決まった名前のファイルだけ。
