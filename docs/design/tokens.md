# デザイントークン（デザインの正本）

web-ui プロジェクトで使う。designer と evaluator はこのファイルを唯一の基準にする。
未整備のうちは designer を呼ばず、ユーザーに資料の提供を依頼する（または designer の「トークン草案モード」で草案を作り、ユーザーが承認する）。

## トーンと方針

- 全体のトーン:
- 視覚的ヒエラルキーの作り方:
- 避けたい印象:

## 色

| トークン | 値 | 用途 |
|---|---|---|
| --color-bg | | 背景 |
| --color-surface | | カード・パネル |
| --color-text | | 本文 |
| --color-text-muted | | 補足 |
| --color-accent | | 主要アクション |
| --color-success / warning / danger | | 状態 |

## タイポグラフィ

| トークン | 値 |
|---|---|
| --font-body | |
| --font-heading | |
| --text-xs … --text-3xl | |
| --leading-body | |

## 余白・角丸・影・モーション

| トークン | 値 |
|---|---|
| --space-1 … --space-8 | |
| --radius-sm / md / lg | |
| --shadow-sm / md | |
| --ease-standard / --duration-fast / --duration-base | |

## 参考画像

`docs/design/references/` に置き、採用した画面と決定事項を同フォルダの `README.md` に書く。
