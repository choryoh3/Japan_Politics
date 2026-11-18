## 試行 1

VERDICT: FAIL
RETURN_TO: generator

## Evaluator 判定: 不合格 (Sprint 2 / 試行 1)

Sprint 2 fails on one functional defect, in the theme switch. 14 of the 15 contract items pass when I operate them in the browser. Item 13 fails: the saved theme is not applied on the not-found pages, and the same bug causes a new console error. One design score (クラフト) is also below 7.

### 不合格理由（重大な順）
1. **The saved theme is ignored on the not-found pages (contract item 13).** Once a not-found page has loaded, navigating from it to a normal page keeps the wrong theme until a full reload.
   - Pages affected: `/persons/99999` and `/cabinets/99999`. The second is a Sprint 1 page, so this is also a regression.
   - Same in dev (3000) and production (`pnpm build` + `next start -p 3100`).
2. **Console error on both not-found pages (dev):** `Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client.` The dev overlay shows a red "1 Issue" badge. It has the same cause as reason 1.
3. **Design: クラフト 6/10, below 7.**
   - At 768px the dates overflow their cells.
   - At 768px a cabinet name breaks mid-word.
   - At 375px the career rows are laid out inconsistently from row to row.

### スプリント契約
- [x] 1. Clicking a name in the roster opens the person page.
  - 手順: `/` → 第1次石破内閣 → clicked 加藤勝信.
  - 観測: opened `/persons/2`. The h1 is 「加藤勝信」, and the paragraph right below it (under a hairline) shows 「かとうかつのぶ」, with an sr-only 「よみがな:」 label.
- [x] 2. Every career row has 5 items (役職 / 所属 / 就任日 / 退任日 / 出典).
  - 手順: collected all person IDs linked from the 9 cabinets (87 people) and parsed each person page.
  - 観測: 177 rows, all with exactly 5 `td` cells, none empty. Every 所属 links to `/cabinets/N`, and every 出典 is an https link.
- [x] 3. Careers are sorted by start date, newest first. Checked the `datetime` attributes for all 87 people: 0 ordering violations.
- [x] 4. 加藤勝信 has both required rows: 菅内閣 / 内閣官房長官 and 第1次石破内閣 / 財務大臣 (5 rows in total). He exists as a single person: id 2, no duplicate names among the 87.
- [x] 5. On `/persons/2`, clicking 「菅内閣」 opened `/cabinets/1` with h1 「菅内閣」.
- [x] 6. Not-found person pages.
  - `/persons/99999`, `0`, `abc`, `-1`, `1.5`, `%3Cscript%3E` and `9999999999999999999999` all return 404 and show 「人物が見つかりません」 plus a link back to the list.
  - On screen: h1 「人物が見つかりません」.
  - The console error in reason 2 occurs on this page.
- [x] 7. The search box with placeholder 「人物・内閣を検索」 is in the header of `/`, `/cabinets/N` and `/persons/N` (and of the not-found pages).
- [x] 8. Typed 「石破」 with real key presses (80ms apart). The candidates appeared 289ms after the last key.
  - Under 人物: 石破茂 (いしばしげる). Under 内閣: 第2次石破内閣 and 第1次石破内閣.
- [x] 9. 「かとうかつ」 → 加藤勝信 is a candidate.
  - Typed with IME composition (CDP `imeSetComposition`), 「いしば」 shows 石破茂 while still composing.
  - Committing 「カトウ」 as katakana → 加藤鮎子 and 加藤勝信.
  - Typing 「イシバ」 → 石破茂.
- [x] 10. 「岸田」 → 第1次岸田内閣 appears under 内閣 (4 cabinets), with 岸田文雄 under 人物.
- [x] 11. 「zzzzz」 → 「該当する結果はありません」 appears (`role=status`, 285ms).
- [x] 12. Keyboard selection works.
  - ↓ selects 石破茂 (`aria-selected` and `aria-activedescendant` are set), then Enter → `/persons/103`, h1 「石破茂」. The input is cleared and the panel closes.
  - Typing 「岸田」 then ↑ wraps to the last option, 第1次岸田内閣. Enter → `/cabinets/2`.
  - Clicking a candidate (加藤鮎子) navigates too.
  - An Enter that confirms IME composition (`isComposing=true`) does not navigate.
  - Esc closes the panel. In Chrome, Esc also clears a `type=search` field.
  - Clicking outside and Tab-ing out both close the panel. Bare Enter with nothing selected does nothing.
- [ ] 13. **不合格**: the theme switch is not saved on the not-found pages.
  - What passes: on `/`, `/cabinets/6` and `/persons/2`, with the OS in light and in dark, clicking the button changes the `body` background (#fff ↔ #000). The choice survives a reload, switching back also survives a reload, and Enter/Space on the button work.
  - 再現手順 A (toggle then reload on a not-found page):
    1. With the OS set to light, clear `localStorage`.
    2. Open `http://localhost:3000/persons/99999`.
    3. Click 「配色を切り替える」. The page turns black (`data-theme=dark`, `localStorage jp-theme=dark`).
    4. Reload.
  - 期待: still dark. 実際: white, with `data-theme` missing (screenshot `s2-nf-after-reload.png`).
  - 再現手順 B (saved dark, then a not-found page): with `jp-theme=dark` saved, open `/cabinets/abc` or `/persons/99999`. The page is white.
  - 再現手順 C (leaving a not-found page): continue from A or B and click 「内閣一覧へ戻る」. `/` is shown white even though dark is saved. It stays white until a full reload.
  - 原因推定:
    - The inline `<script dangerouslySetInnerHTML>` in the root layout's `<head>` (`apps/web/src/app/layout.tsx`, `THEME_INIT_SCRIPT`) is missing from the not-found HTML.
    - When `notFound()` runs in a dynamic page, Next builds the not-found tree on the client from the RSC payload. React does not run `<script>` elements it renders on the client.
    - Evidence: `curl http://localhost:3100/persons/99999` has the script only as an escaped string inside the RSC payload, while `/persons/2` has it as a real `<script>` in `<head>`. A MutationObserver showed `data-theme` was already null at DOMContentLoaded.
  - 修正指示 (`apps/web/src/app/layout.tsx`), either of these:
    - (a) Recommended: in the toggle, also save the choice to a cookie. In the root layout, read it with `cookies()` and render `<html data-theme={...}>` on the server. This needs no inline script, so the console error goes away too.
    - (b) Load the script with `next/script` and `strategy="beforeInteractive"`.
  - Either way, also make `ThemeToggle` (`apps/web/src/components/theme-toggle.tsx`) re-apply the saved value to `html` on mount, as a safety net for navigating away from a not-found page.
  - Add a regression test (unit or e2e): on a not-found page, toggle to dark, reload, and the page is still dark.
  - 戻し先: generator
- [x] 14. `lang="ja"` on `/`, `/persons/2`, `/cabinets/1` and `/persons/99999`.
- [x] 15. 回帰: clicking a cabinet name on `/` opens its page, and roster row 1 is 内閣総理大臣 in all 9 cabinets.

### 回帰確認（Sprint 1）
- [x] `/` shows the h1 「歴代内閣」 and 9 rows. 菅内閣, 第1次岸田内閣 and 第1次石破内閣 are all present.
- [x] Each row has 4 cells. 「現在」 appears only in row 1. Rows are newest first, and 菅内閣 is last.
- [x] Each cabinet's h1 matches the name clicked. 菅内閣 shows 発足日 2020年9月16日 and 終了日 2021年10月4日.
- [x] 第1次石破内閣 has 19 roster rows and includes 内閣官房長官 / 林芳正.
- [x] All 9 cabinets: row 1 is 内閣総理大臣, row 2 is 内閣官房長官, and every row has one 出典 link starting `https://www.kantei.go.jp/`.
- [x] `/cabinets/99999` returns 404 with 「内閣が見つかりません」 and a link back to the list.
  - **Regression:** the console error and the theme problem from reason 1 now also occur here.
- [x] Seeding twice is idempotent.
  - With a new scratch DB `eval-s2-t1.db`: `db:migrate` → `db:seed` → `db:seed` all exited 0. Counts stayed `[9, 87, 177]` (cabinets, persons, appointments) before and after the second seed.
  - 0 persons lack a kana reading.

### エッジケース・健全性
- **My own runs:**
  - `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm test` all passed (db 14, web 8).
  - `pnpm build` succeeded.
- **Console:**
  - In dev, the script-tag error from reason 2 appears on both not-found pages.
  - Other errors are only the expected 404 resource messages.
  - There was one transient HMR WebSocket failure, around my build and an outside commit; I treat it as environmental.
- **Network:** no 5xx.
- **Search API:**
  - A query of 51+ characters returns 400 `{"error":"検索語が不正です"}`.
  - `/api/persons/abc` returns 400. `/api/persons/99999` returns 404.
  - An empty query returns 200 with empty results.
  - `%`, `_`, `<script>`, emoji and quote characters are handled safely: no injection, and they return no results.
- **Secrets:**
  - In dev, the not-found HTML contains `data-next-error-stack` with server paths. This is Next's dev-only behaviour.
  - Production has no stack and no paths. No secrets were exposed.
- **Matching gaps (outside the contract, for reference):**
  - Half-width katakana 「ｲｼﾊﾞ」 returns 0 results.
  - Full-width-space-separated 「かとう　かつのぶ」 returns 0 results.
- **Minor search behaviour:** while a new query is loading, the previous results stay visible, so ↓ + Enter can open a stale candidate.
- **Keyboard (production, 3100):**
  - Tab order: logo → search → theme button → 「内閣一覧へ戻る」 → 所属 → 出典 → … (natural order).
  - Focus rings: white 2px on the black header and the blue band. On the white canvas they are #53b1ff 2px.
  - The theme button's focus ring and hover (white at 10% opacity) are both visible.
- **Horizontal scroll:** none for `/` or `/persons/103` or `/persons/2` at 375/768/1024/1280 in light and dark (`scrollWidth` equals the viewport width each time).
- **Dates:** no mid-date line breaks.
- **出典 alignment (designer's question):** on `/persons/103` and `/persons/2` at 375, every row's 出典 ends at the same right edge (x=351).

### デザイン評価（閾値 7/10）
- **デザインの質: 7/10.**
  - The person page follows the cabinet page's structure: blue chapter band, h1 at weight 300 (54px at 1280), hairline, kana, then 「経歴」 on the canvas. The hierarchy is clear (`s2-light-1280-p2.png`).
  - Deduction: the search panel and the no-results message use `shadow-lg`. DESIGN.md says "no drop shadows beyond a faint section-divide" (`s2-search-none-light-1024.png`).
- **オリジナリティ: 7/10.**
  - The black header, blue band and canvas chapters stay consistent.
  - The search panel's group labels and the blue fill on the selected candidate fit the PlayStation look.
  - AI-slop signs: 0.
- **クラフト: 6/10 — 閾値未達.**
  - (a) **768px, `/persons/2`:**
    - 就任日 and 退任日 are `whitespace-nowrap` in 20% columns, so 「2024年11月11日」 runs 20px into the cell padding. Only about 12px is left before the next column's text, which looks crowded (`s2-search-ishiba-1280.png` was taken at 768 wide).
    - The same 768 screenshot shows 所属 breaking mid-word as 「第2次岸田第2次 / 改造内閣」.
  - (b) **375px, `/persons/2`:**
    - Rows 1–2 stack 就任日 and 退任日 vertically (退任日 at left=24). Rows 3–5 put them side by side (退任日 at left=199). The layout changes from row to row (`s2-light-375-p2-scrolled.png`).
  - (c) **Not-found pages:** the page shows light even when dark is chosen (`s2-nf-after-reload.png`).
  - 修正指示 (designer, after generator's fix), in `apps/web/src/app/persons/[id]/page.tsx`:
    - Rebalance the md column widths, for example 役職 20% / 所属 28% / dates 22% each / 出典 8%, or lower the date size one step at md, so dates fit inside their cell padding at 768.
    - Apply `word-break: keep-all` or `auto-phrase` to 所属.
    - At max-md, make the date cells `w-full` (always stacked) or always side by side, so every row has the same layout.
- **機能性: 7/10.**
  - Search works fully by keyboard: ↑↓, Enter, Esc, IME. The ARIA is in place: `combobox`, `listbox`, `option`, `aria-activedescendant`, `role=status`.
  - Touch targets are 44px.
  - Deduction 1: the saved theme is lost on the not-found pages.
  - Deduction 2: on the white canvas, the #53b1ff focus ring is only about 2.3:1 against white, below the 3:1 recommended for non-text contrast (`s2-focus-cablink-light.png`). On light canvases, use `link-light` #0064b7 or ink for the ring.

### 再テスト対象（次回、最初に確認する項目）
1. Repeat 再現手順 A, B and C from item 13 in dev and in production.
2. The not-found pages (`/persons/99999`, `/cabinets/99999`) show no `Encountered a script tag` console error.
3. The theme still works on `/`, `/cabinets/6` and `/persons/2`: OS light/dark × toggle × reload, and no flash of the wrong theme on first paint.
4. At 768 on `/persons/2`, date overflow and the 所属 line break. At 375, the career rows share one layout.

### 評価で残したもの・副作用
- **Scratch DB:** `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s2-t1.db`. I did not seed the real `local.db`.
- **Screenshots:** in `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/`:
  - `s2-{light|dark}-{375|768|1024|1280}-{p103|p2|home}.png`
  - `s2-light-375-p2-scrolled.png`
  - `s2-search-*.png`, `s2-search-none-*.png`
  - `s2-nf-after-toggle.png`, `s2-nf-after-reload.png`, `s2-prod-nf-saved-dark.png`
  - `s2-focus-*.png`, `s2-hover-toggle-*.png`
- **Production server log:** `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/prod3100.log`. The production server on 3100 is stopped; the dev server on 3000 is still running and responding.
- **Repository side effect:**
  - Running `pnpm build` let Next regenerate `apps/web/next-env.d.ts`: the import paths changed from `./.next/dev/types/...` to `./.next/types/...`.
  - It is now the only uncommitted change (`git status`). I may not run `git checkout`, so it is still there.
  - Please revert it, or let `pnpm dev` regenerate it on the next start. Do not commit it.
  - I edited no other code or docs.
- **localStorage:** test values were left only on the 3100 origin, which is now stopped.
- **Browser:** closed.

VERDICT: FAIL
RETURN_TO: generator
