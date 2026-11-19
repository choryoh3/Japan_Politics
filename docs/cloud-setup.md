# 環境セットアップ手順（ローカル / Claude Code on the web）

MCP の設定は `.mcp.json`（git 管理）にあり、シークレットは環境変数で渡す。キーの実値は、ファイル・ログ・報告に書かない。

## 共通: 必要な環境変数

| 変数 | 用途 | 値 |
|---|---|---|
| `CONTEXT7_API_KEY` | Context7 MCP の認証（`.mcp.json` の `Authorization: Bearer ${CONTEXT7_API_KEY}`） | https://context7.com/dashboard?tab=settings で取得したキー |
| `MCP_TIMEOUT` | MCP の起動待ち（ミリ秒）。`.claude/settings.json` の `env` でも設定済み | `60000` |

変数が未設定だと、Context7 だけ接続に失敗する。他の MCP には影響しない。

## ローカル（Windows）

1. uv をインストールする: `winget install astral-sh.uv`（Serena の起動に必要）
2. ユーザー環境変数を設定する（PowerShell）: `setx CONTEXT7_API_KEY "<キー>"`
3. VSCode を**完全に終了して**起動し直す（環境変数は起動時にしか読み込まれない）
4. `/mcp` で playwright / context7 / serena が接続済みか確認する

## クラウド（Claude Code on the web）

claude.ai/code の環境セレクタ → 歯車アイコンで、環境ごとに次を設定する。

### 1. ネットワーク

- Network access: **Limited**（「Allow package managers」ON）のまま使う
- Allowed domains に追加: `mcp.context7.com`、`ui.shadcn.com`（shadcn/ui のレジストリ）、`fonts.googleapis.com` と `fonts.gstatic.com`（next/font のビルド時取得）
- Turso に実接続するときだけ追加: `<db名>-<org名>.turso.io`（DB 作成後に判明。ワイルドカード不可）。Platform API を使うなら `api.turso.tech`
- Vercel CLI を使うときだけ追加: `api.vercel.com`（通常は Git 連携で配備するため不要）
- github.com / pypi.org / registry.npmjs.org は既定で許可済み（Serena の取得に使う）

### 2. 環境変数（`.env` 形式）

```
CONTEXT7_API_KEY=<キー>
MCP_TIMEOUT=60000
PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/google-chrome
PLAYWRIGHT_MCP_HEADLESS=true
PLAYWRIGHT_MCP_SANDBOX=false
NEXT_TELEMETRY_DISABLED=1
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=file:./local.db
COREPACK_ENABLE_DOWNLOAD_PROMPT=0
```

Turso 接続時のシークレット（`TURSO_AUTH_TOKEN`、`BETTER_AUTH_SECRET`）は、必要になった時点でユーザー自身が環境設定に追加する。`CI=true` は `pnpm install` を lockfile 固定にするため設定しない。

- 環境変数は、その環境を使える全員が読める。共有の環境にキーを置く場合は、チームで合意してから設定する
- Playwright のブラウザ配布元は既定の許可リストにないため、同梱の Chrome を指定する。`PLAYWRIGHT_MCP_*` は @playwright/mcp の公式の環境変数
- `PLAYWRIGHT_MCP_SANDBOX=false` は、クラウドの VM が root で動くための設定

### 3. セットアップスクリプト（Serena のキャッシュを温める）

Serena の初回起動は依存関係のビルドで1〜2分かかる。環境キャッシュに載せて、セッション起動時の待ちを減らす。

```bash
#!/bin/bash
uvx --from git+https://github.com/oraios/serena@v2.1.0 serena --help >/dev/null 2>&1 || true
```

- 失敗してもセッションの起動を止めないよう、`|| true` を付ける
- スクリプトは環境変数が設定される前に走るため、スクリプト内で `CONTEXT7_API_KEY` などは参照できない

### 4. 動作確認

小さなタスクを1回流し、`/mcp` で3つの接続状態を確認する。

## 未確認の事項（初回の実機確認で見る）

- Serena が使う Python 3.13 の取得元（`uvx -p 3.13`）が、Limited の許可リストで通るか。通らない場合は、Allowed domains の追加か Full が必要
- `settings.json` の `MCP_TIMEOUT` が、クラウドの起動待ちに効くか。効かない場合は、環境変数側の設定が効く
- uv のキャッシュが、環境キャッシュのスナップショットに含まれるか
- `enabledPlugins`（superpowers）は、クラウドでは読み込まれない。このハーネスは依存していないため、影響はない
- Serena が使えない場合、generator は Read / Grep / Edit で代替し、完了報告に「Serena 未使用」と書く
