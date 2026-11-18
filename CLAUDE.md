# 開発ルール（マルチエージェント・ハーネス）

このプロジェクトは4つのサブエージェント（`.claude/agents/`）で開発を進める。
**メインセッションがオーケストレーターとなり、サブエージェントを順番に呼び出す。**
サブエージェント同士は直接やり取りできず、他のサブエージェントを起動することもできない。受け渡しはすべてメインセッションが行う。

> プロジェクト固有の事情（技術スタック、デザイン方針、評価の例外など）は、このファイルの末尾「プロジェクト固有のルール」と `docs/project.md` に書く。ハーネス本体の規則は変更しない。

## エージェントの役割

| エージェント | 役割 | 入力 | 出力 |
|---|---|---|---|
| `planner` | 要件を仕様書とスプリント契約にする。契約の修正も担当 | ユーザーの短い依頼、`docs/project.md` | `docs/spec.md`, `docs/sprints/sprint-N.md` |
| `generator` | 契約を満たす動く実装とテストを作る | スプリント契約 | コード、テスト、完了報告 |
| `designer` | トークンに沿って見た目を磨く（機能は変えない）。UI評価ありのときだけ | `docs/design/`、Generator の完了報告 | スタイル/レイアウトの変更、完了報告 |
| `evaluator` | 実際に動かして合否を判定する | スプリント契約、`docs/project.md`、起動中のアプリ | `VERDICT: PASS/FAIL` 付きの判定 |

## ワークフロー

```
/init-project（最初に1回）
  └─ /kickoff: planner → ユーザー承認
       └─ /sprint N（スプリントごとに繰り返す）:
            generator → 品質ゲート → (designer) → evaluator
               ↑                          ↑            │
               │                          └ デザイン不合格 ┤
               └────────── 機能・契約の不合格 ───────────┘
```

1. **準備**: `/init-project` で `docs/project.md`（種別・起動・検証コマンド・UI評価の有無）を作る。
2. **計画**: `/kickoff <依頼>` で `planner` を呼ぶ。生成物と「確認事項」をユーザーに提示し、**承認を得てから**実装に進む。
3. **実装**: `generator` に、契約ファイルのパスとスプリント番号を渡して呼ぶ。
4. **品質ゲート**: メインセッションが `docs/project.md` の静的検査・テスト・ビルドを実行する。失敗なら `generator` に戻す。
5. **デザイン**: `UI評価: あり` のときだけ、`generator` の完了報告（特に「Designer への引き継ぎ」）を原文のまま添えて `designer` を呼ぶ。
6. **評価**: メインセッションがアプリを起動して応答を確認し、`evaluator` を呼ぶ。
7. **判定**: `PASS` なら次のスプリントへ。`FAIL` なら下記の差し戻しルールに従う。

## コマンド

| コマンド | 用途 |
|---|---|
| `/init-project [説明]` | `docs/project.md` を作る・更新する |
| `/kickoff <依頼>` | planner で仕様書とスプリント計画を作り、承認を求める |
| `/sprint <N>` | Sprint N を実装→評価し、差し戻しルールに従って完了させる |
| `/status` | 進捗と各スプリントの最新判定を表示する |
| `/replan <N> <問題点>` | 契約の不明確・矛盾を planner に直させる（承認制） |

## 受け渡しのルール

- 各エージェントを呼ぶとき、**契約ファイルのパス、前段の完了報告、対象スプリント番号、`docs/project.md` の参照**を必ずプロンプトに含める。サブエージェントは会話履歴を持たない。
- 前段の報告は要約せず、原文のまま渡す（特に未通過項目、既知の制限事項、引き継ぎ事項）。
- `evaluator` を呼ぶ前に、メインセッションがアプリを起動して応答を確認する。起動できない場合は評価に進まず、ユーザーに報告する。
- `evaluator` は書き込み権限を持たない。**メインセッションが** evaluator の判定を原文のまま `docs/sprints/sprint-N-eval.md` に保存する（再テストの手順を残すため）。差し戻しのたびに追記する。
- 判定は、出力の `VERDICT:` 行と `RETURN_TO:` 行で機械的に読む（`python3 scripts/validate_docs.py --verdict N`）。

## 差し戻しルール

- `evaluator` の不合格フィードバックには、戻し先（`RETURN_TO`）が明記される。**その指示に従って該当エージェントだけを呼び直す。**
  - 機能・契約条件・回帰の不合格 → `generator`
  - デザイン基準（質・オリジナリティ・クラフト・機能性）のみの不合格 → `designer`
  - 契約自体が不明確・矛盾 → `planner`（`/replan`。ユーザーの承認を得る）
- 呼び直すときは、`evaluator` のフィードバックを原文のまま渡す。
- `designer` の修正後は、`evaluator` で再テストする。
- `generator` の修正後は、品質ゲートを通し、**デザインが崩れていないか確認するため `designer` を通してから**（UI評価ありのとき）`evaluator` で再テストする。
- 再テストでは、前回の不合格項目を最初に確認させる。
- **差し戻しは1スプリントにつき最大3回まで。** 3回目も不合格ならループを止め、未解決の項目と原因の見立てをユーザーに報告して判断を仰ぐ。
  - 品質ゲート失敗、評価環境の問題（`RETURN_TO: none`）、契約修正による再実行は回数に数えない。
- 契約条件が不明確・矛盾している場合は、`generator` や `evaluator` に推測させず、`planner` に契約の修正を依頼する（ユーザーの承認を得る）。

## 禁止事項

- スプリント契約を満たさないまま次のスプリントに進めない。
- `evaluator` の不合格を、メインセッションの判断で合格に覆さない。
- `designer` に機能ロジックを変更させない。`generator` にデザインの磨き込みをさせない。
- `evaluator` にコードを修正させない（評価と指摘のみ）。
- 契約の「後で対応」「TODO」を認めない。未完了項目は完了報告に正直に記載させる。
- ユーザーの承認なしに、仕様・契約を変更しない。
- サブエージェントに git の commit / push をさせない。バージョン管理はメインセッションとユーザーが行う。
- シークレット（`.env` の中身、トークン、鍵）をファイル・ログ・報告に書かない。

## ファイル配置

- `docs/project.md` — プロジェクト設定（種別、起動・検証コマンド、UI評価の有無、評価上の注意）
- `docs/spec.md` — 製品仕様書
- `docs/sprints/sprint-N.md` — スプリント計画と契約
- `docs/sprints/sprint-N-eval.md` — Evaluator の判定記録
- `docs/progress.md` — 進捗と引き継ぎ事項（`/sprint` が更新）
- `docs/design/tokens.md` — デザイントークン（デザインの正本。UI評価ありのとき）
- `docs/design/` — 参考画像、ブランド資料
- `.claude/agents/` — サブエージェント定義
- `.claude/commands/` — スラッシュコマンド
- `.claude/settings.json` — 権限とフック
- `scripts/validate_docs.py` — ドキュメントの機械検証
- `.mcp.json` — MCP の設定（Playwright: evaluator / designer、Context7: generator、Serena: generator / メインセッション）

## ライブラリ API の扱い

- `generator` はライブラリ・フレームワークの API を推測で書かず、Context7 MCP で最新ドキュメントを確認してから実装する。
- Context7 を使うのは `generator` のみ。他のエージェントには許可しない（ツール定義によるコンテキスト消費を避けるため）。
- Serena（既存コードのシンボル単位の探索・編集）を使うのは `generator` とメインセッションのみ。`evaluator`（コードを直さない）、`designer`、`planner` には許可しない。
  - Serena は `serena_repl` 1ツールに機能が集約され、ツール名では読み取り / 書き込みを区別できない。シェル実行は `.serena/project.yml` の `excluded_apis` で無効にし、コマンド実行は Bash と `settings.json` の権限ルールに任せる。
  - REPL は `settings.json` の `Read` 拒否ルール（`.env` など）を素通りできるため、PreToolUse フック（`scripts/block_serena_secrets.py`）が `serena_repl` のコードを実行前に検査し、機密ファイルへの参照や `open()` / `import os` などの迂回手段を拒否する。これは「うっかり」を防ぐ対策で、意図的な迂回までは防げない。
  - 技術スタックが決まったら、`.serena/project.yml` の `language_servers` を合わせる。

## ハーネス（自動チェック）

- `scripts/validate_docs.py` が `docs/project.md`、`docs/spec.md`、`docs/sprints/sprint-N.md`、`sprint-N-eval.md` を機械検証する。
  - 検証内容: プロジェクト種別・必須項目、機能数（既定 2〜4）、契約項目数（既定 5〜15）、曖昧な表現・実装詳細・先送り表現の禁止、「対象外」セクション、スプリント番号の連続性、判定行（`VERDICT` / `RETURN_TO`）。
  - 閾値は `docs/project.md` の「ハーネス設定」で上書きできる。
  - Claude Code のフック（`.claude/settings.json` の PostToolUse）が、これらのファイルを書き込むたびに自動実行する。エラーは書いたエージェントに差し戻される。
  - CI（`.github/workflows/validate-docs.yml`）でも実行される。手動実行は `python3 scripts/validate_docs.py`。
- `.claude/settings.json` の権限設定で、`.env` 系の読み取り、`git push --force`、`git reset --hard` などを禁止し、`git push` は確認を求める。

## 前提

- 検証スクリプトの実行には Python 3 が必要（`python3` → `python` → `py` の順に、実際に動くものを使う）。Windows の Microsoft Store スタブは動かないので注意。Python が無いとフックの自動検証は警告だけでスキップされる。
- Playwright MCP（`npx` で起動）の利用には Node.js が必要。初回は MCP サーバーの有効化の承認が出る。
- Context7 MCP はリモート接続（HTTP）で、認証は API キー方式（`Authorization: Bearer`）。キーは環境変数 `CONTEXT7_API_KEY` で渡し（`.mcp.json` は `${CONTEXT7_API_KEY}` を参照するだけ）、`.mcp.json` や他のファイルに書かず、コミットしない。ローカルでは OS のユーザー環境変数に設定し、クラウドでは環境設定の環境変数に設定する（手順は `docs/cloud-setup.md`）。
- MCP を追加するときは、バージョンを固定し（`npx` 起動のもの）、担当エージェントの `tools` / `mcpServers` と本ファイルの役割表を更新する。書き込み権限を持つ MCP（決済・DB など）は、接続先をテスト用・開発用に限定する。
- UI評価ありのプロジェクトで `docs/design/tokens.md` が未整備のうちは、`designer` を呼ぶ前にユーザーへ資料の提供を依頼する（または `designer` の「トークン草案モード」を使い、ユーザーが承認する）。

## プロジェクト固有のルール

### 技術スタック（各公式ドキュメント準拠。API は Context7 で確認してから書く）

- 構成: pnpm monorepo（pnpm 10、`packageManager` で固定）
- フロント: Next.js（App Router）、TypeScript strict、Tailwind CSS、shadcn/ui、next-intl（文言は全て辞書化。直書き禁止）、TanStack Query
- バックエンド: Hono（Next.js の Route Handler に同居）、zod（入出力の検証）
- DB / 認証: Turso（libSQL）+ Drizzle ORM、Better Auth
- 品質: Vitest、ESLint + Prettier、GitHub Actions
- 配備: Vercel（Git 連携）

### コーディング規約

- 全ての関数・型・コンポーネントに JSDoc を付ける（何をするか、引数、戻り値を平易な日本語で）。
- 優しく読みやすいコードを優先する。名前は意味が分かるものにし、1関数1責務、早期 return、過度な抽象化はしない。
- コメントは「なぜそうしたか」を中心に、初学者にも分かる言葉で書く。
- `any` と `@ts-ignore` は使わない。外部入力は zod で検証してから使う。

### 環境の注意

- ローカル・クラウドの DB は `DATABASE_URL=file:./local.db`（ファイル DB）で動かす。Turso 接続は `docs/cloud-setup.md` の手順で、ホストを Allowed domains に追加してから。
- シークレット（`TURSO_AUTH_TOKEN`、`BETTER_AUTH_SECRET`）は環境変数でのみ渡し、`.env.example` には名前だけ書く。
- 評価上の例外は `docs/project.md` の「評価上の注意」にも書くこと。
