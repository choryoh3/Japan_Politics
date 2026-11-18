## 試行 1

VERDICT: FAIL
RETURN_TO: designer

## Evaluator 判定: 不合格 (Sprint 1 / 試行 1)

All 15 contract items pass, and nothing regressed (this is the first sprint). Sprint 1 still fails because the design score for **機能性 (functionality) is 6/10, below the 7/10 threshold**. The cause is the 375px layout: the 出典 (source) column and the date columns sit fully off-screen, and nothing on screen tells the user to scroll sideways. There is also one console error from a missing favicon (details in item 2).

### 不合格理由（重大な順）
1. **At 375px, required information is off-screen with nothing showing it is there.**
   - 再現手順:
     1. `browser_resize` to 375x812.
     2. Open `http://localhost:3000/cabinets/6`.
     3. Measure the column header positions with `getBoundingClientRect`.
   - 実際（詳細画面）: The table has `min-w-[640px]` inside `div.mt-6.overflow-x-auto`. The columns measure 役職 24–280, 氏名 280–484, 在任 484–571, 出典 571–664, while the visible content ends at 351px. So the 在任 and 出典 columns are completely outside the screen.
   - 実際（一覧 `/`）: The 発足日 and 終了日 columns, including 「現在」, are completely off-screen. Only 内閣名 and 内閣総理大臣 are visible.
   - 影響: There is no visible cue that the table scrolls sideways: no shadow or fade at the edge, no hint text, no caption, and no visible scrollbar in the screenshot. A mobile user cannot tell that sources exist, and sources are central to this sprint. On `/cabinets/5`, the two 内閣官房長官 rows (松野博一 and 林芳正) appear with no dates, so they look like a duplicate. The header 「内閣総理大臣」 also breaks as 「内閣総理大 / 臣」.
   - 修正指示（designer, in `apps/web/src/app/page.tsx` and `apps/web/src/app/cabinets/[id]/page.tsx`, table markup and classes only, no logic changes). Use one of these approaches:
     - (a) Below `md`, switch to a stacked layout per row. On the list: 内閣名 on the first line, then 総理・発足日〜終了日. On the detail page: 役職 / 氏名 / 在任 / 出典 stacked.
     - (b) Keep the horizontal scroll, but add a clear cue that it scrolls, using a DESIGN.md hairline or a mute colour, not a decorative gradient. Also lower `min-w` so 出典 is at least partly visible, and stop the header text breaking mid-word (for example `whitespace-nowrap`).
     - In either case, add a `<caption>` or `aria-label` to the table.
2. **A console error from the missing favicon.**
   - 証拠: `curl http://localhost:3000/favicon.ico` returns 404. This browser session's console log contains `[ERROR] Failed to load resource: 404 @ /favicon.ico`.
   - 注意: My fresh isolated headless context did not request the favicon, so I could not reproduce the error there. Ordinary browsers request it on first load.
   - There is no `apps/web/public` folder, and `src/app` has no `icon`/`favicon` file.
   - 修正指示: Add an original app icon (`apps/web/src/app/icon.svg` or similar) that does not use PlayStation logos or trademarks.
   - 戻し先: designer. This is only an asset; if the main session sees it as a generator matter, either agent can handle it.

### スプリント契約 (15/15 合格)
- [x] 1. The 初期データ・準備 section of `docs/project.md` lists `pnpm install` / `pnpm db:migrate` / `pnpm db:seed` (and `db:setup`). Checked by reading the file.
- [x] 2. Starting with no DB, I pointed `DATABASE_URL=file:<scratchpad>/eval-s1.db` at a new file. `pnpm install --frozen-lockfile --offline`, `db:migrate` and `db:seed` all exited with code 0. I used a separate file so the project's `local.db` was not deleted.
- [x] 3. Seeding twice does not add rows.
  - Scratch DB, before and after another seed: cabinets 9, persons 87, cabinet_appointments 177 both times.
  - Real `local.db`: I ran `pnpm db:seed` twice. The list still has 9 entries (HTML and `/api/cabinets`), and IDs 1–9 are unchanged.
- [x] 4. `/` shows the heading 「歴代内閣」 and 9 cabinets.
- [x] 5. The list includes 菅内閣, 第1次岸田内閣 and 第1次石破内閣.
- [x] 6. Every row shows 内閣名, 総理氏名, 発足日 and 終了日 (checked at 1280px).
- [x] 7. Only one row says 「現在」 (第2次高市内閣), and it is the first row.
- [x] 8. Rows are in newest-first order of 発足日 (2026-02-18 down to 2020-09-16), and 菅内閣 is the last row.
- [x] 9. Clicking 菅内閣 opens `/cabinets/1` with the h1 「菅内閣」. The h1 matches the cabinet name for all 9 IDs.
- [x] 10. 菅内閣 shows 発足日 2020年9月16日 and 終了日 2021年10月4日.
- [x] 11. 第1次石破内閣 has 19 roster rows (15 or more required), with no empty 役職 or 氏名.
- [x] 12. For all 9 cabinets, row 1 is 内閣総理大臣 and row 2 is 内閣官房長官.
- [x] 13. 第1次石破内閣 has the row 内閣官房長官 / 林芳正.
- [x] 14. Across all 9 cabinets, every row has exactly one 出典 link, and every link starts with `https://www.kantei.go.jp/` (`target=_blank`, `rel=noopener noreferrer`).
- [x] 15. `/cabinets/99999`, `0`, `-1`, `abc`, `1.5`, `<script>`, `1e3`, `01` and a 22-digit ID all return 404. Each shows 「内閣が見つかりません」 and a 「内閣一覧へ戻る」 link to `/`.

### 回帰確認
- None to check: this is the first sprint.

### エッジケース・健全性
- `pnpm test` passes (db 8 tests, web 6 tests). `pnpm lint` and `pnpm typecheck` pass.
- I did not run `pnpm build`, to avoid touching `.next` while the dev server was running.
- Console in a fresh context: no errors or warnings on `/` or the detail pages. The 404 response on the not-found page follows the contract, so I did not count it. The favicon 404 is item 2 above.
- An earlier part of this browser session logged HMR WebSocket ERR_CONNECTION_REFUSED errors. They look like they came from a dev server restart before this evaluation, and I could not reproduce them.
- Network: no 5xx. `/api/cabinets/abc` returns 400 `{"error":"内閣 ID が不正です"}` with no stack trace. No secrets are exposed. The `sourceNote` text says plainly that the data is unconfirmed.
- Keyboard: Tab moves through the links in order, with a visible 2px `#0064b7` focus outline. `html lang="ja"` is set.
- UI text: I found no Japanese strings written directly in the `.tsx` files; it comes from `messages/ja.json`.
- Minor: the page title is 「日本の人事データベース」 on every page, so it does not include the cabinet name.

### デザイン評価
DESIGN.md exists and I compared the screens against it.
- **デザインの質: 7/10.** h1 is 54px / weight 300; the lead text is `rgba(0,0,0,.6)` (body-light); table headers are 14px in mute `#6b6b6b`; links are `#0064b7` and `#53b1ff` in dark mode; the header is a black bar; rows are divided by hairlines. This matches the tokens and the hierarchy is clear. Deductions: 「現在」 looks the same as an ordinary date, so the current cabinet does not stand out, and in dark mode the header blends into the black canvas.
- **オリジナリティ: 6/10.** None of the "AI slop" signs apply: no gradients, no grid of cards, no icons, no glow. The editorial table with large light headings has its own character. Still, the list and detail pages are both just a heading plus a table, with little of the product's own personality.
- **クラフト: 5/10.** Column widths change between cabinets because the table uses auto layout: 氏名 starts at x≈529 on 第1次石破内閣 but ≈473 on 菅内閣. At 375px, the header 「内閣総理大臣」 breaks mid-word and the h1 「第2次岸田第2次改造内閣」 breaks with 「閣」 alone on the second line. Item 2 (no favicon) also applies.
- **機能性: 6/10 — below the threshold.** Desktop and 768px work well. At 375px, 出典, 在任, the dates and 「現在」 are all off-screen with nothing showing they are there (item 1). Fix: as in item 1. 戻し先: designer.

### 再テスト対象（次回、最初に確認する項目）
- At 375px, `/` shows 内閣名, 総理, 発足日 and 終了日/「現在」, or makes it clear they can be reached by scrolling.
- At 375px, `/cabinets/6` and `/cabinets/5` show 在任 and 出典, or make it clear they can be reached by scrolling.
- `curl -I http://localhost:3000/favicon.ico` (or the icon link) no longer returns 404.
- Contract items 6, 7, 11, 12 and 14, to confirm the design fix did not break the structure.

### 評価で残したもの
- A scratch DB: `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s1.db` (and `inst.log`).
- Screenshots and logs written automatically by Playwright under `/home/user/Japan_Politics/.playwright-mcp/`. They are tool output, not deliverables.
- `pnpm db:seed` run twice on the real `local.db`, as contract item 3 requires. Row counts did not change.
- I edited no code or docs. `apps/web/next-env.d.ts` already showed as modified (`M`) when I started.
- The browser is closed.

VERDICT: FAIL
RETURN_TO: designer
