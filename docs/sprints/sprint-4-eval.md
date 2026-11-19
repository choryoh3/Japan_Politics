## 試行 1

VERDICT: FAIL
RETURN_TO: designer

## Evaluator 判定: 不合格 (Sprint 4 / 試行 1)

All 15 contract items pass, and so do the regression and permission checks. The sprint fails on one design criterion, クラフト (craft): on the roster (閣僚名簿), when a cabinet appointment has both a start date and an end date, the tenure column runs into the 出典 (source) column and the two texts sit on top of each other. Because every contract item passes, this goes back to `designer`.

### 不合格理由（重大な順）
1. **Roster tenure text overflows its cell and overlaps the source column (768 / 1024 / 1280px, every role).**
   - 再現手順:
     1. Log in as admin.
     2. In any cabinet, add a cabinet appointment with both 就任日 and 退任日 filled in. The same thing happens when you use the contract item 12 flow to add 退任日 to a row that already has 就任日.
     3. Open the cabinet detail page at 768, 1024 or 1280px wide.
   - 期待: 「2023年1月1日から2023年2月1日まで」 stays inside the 在任 column and does not touch the 出典 column.
   - 実際 (cabinet /cabinets/11, first row):

     | Width | View | Tenure cell right edge | Text right edge |
     |---|---|---|---|
     | 768px | admin | 478px | 600px |
     | 1024px | admin | 642px | 713px |
     | 1280px | admin | 806px | 825px |
     | 768px | logged out | 612px | 707px |

     - At 768px (admin) the text also runs under the 操作 column.
     - The screenshots show the text drawn on top of 「出典なし」 (`cab11-table-1024.png`, `cab11-table-768-anon.png`). At 1280px the two texts touch with no gap (「…2月1日まで出典なし」).
   - At 768px admin, 「出典なし」 also breaks in the middle of the word (「出典な／し」), and the 編集 / 削除 buttons stack vertically (`r-cab11-768.png`).
   - 原因推定: in `apps/web/src/app/cabinets/[id]/page.tsx`, line 169, the tenure `<td>` has `md:whitespace-nowrap`. The table uses fixed column widths (`w-[20%]` and so on), so the text cannot wrap and spills out. The seed data has no rows with both dates, so this did not show up in Sprints 1–3. Sprint 4's new feature is what produces this kind of row.
   - 修正指示 (designer):
     - Let the tenure wrap at 「から」, as two lines: 「2023年1月1日から」 and 「2023年2月1日まで」. For example, put each date phrase in its own `whitespace-nowrap` span and allow wrapping between them. Alternatively, rebalance the column widths (役職 / 氏名 are wide; 在任 is narrow).
     - Give 「出典なし」 `whitespace-nowrap` so it never breaks mid-word.
     - Keep 編集 / 削除 on one line at 768px.
     - Make sure 「2026年10月21日から2026年12月31日まで」, the longest form, does not overflow at 768 / 1024 / 1280, with and without the 操作 column.
   - 戻し先: designer

### スプリント契約
Setup: production build on port 3100 with a disposable DB (`eval-s4.db` in the scratchpad), admin `s4admin@eval.example.test`, regular user `s4user@eval.example.test`.

- [x] **1. Admin buttons hidden for logged-out and regular users.**
  - 手順: as logged-out and as a regular user, list the link and button text on `/`, `/cabinets/6` and `/cabinets/9`.
  - 観測: 「内閣を追加」「内閣を編集」「閣僚を追加」「編集」「削除」 and the 操作 column were all absent. As admin, 「内閣を追加」 is shown.
- [x] **2. New cabinet appears in start-date order.**
  - 手順: 内閣を追加 → 「評価追加内閣」, 2023-01-01 → 保存.
  - 観測: redirected to `/`; the row sits between 第2次岸田第2次改造内閣 (2023-09-13) and 第2次岸田改造内閣 (2022-08-10).
- [x] **3. Empty state.**
  - 観測: `/cabinets/11` shows 「登録された閣僚はいません」.
- [x] **4. Empty cabinet name.**
  - 観測: 「内閣名は必須です」 is shown as `role=alert`, `aria-invalid` is on name, focus moves to name. The cabinet count stays at 10.
- [x] **5. End date before start date.**
  - 手順: start 2027-04-01, end 2027-03-31.
  - 観測: 「終了日は発足日以降の日付にしてください」, focus moves to endDate, nothing is added.
- [x] **6. Add an appointment by picking an existing person.**
  - 手順: 内閣官房長官, typed 「芳正」 → picked candidate 「林芳正 はやしよしまさ」, 就任日 2023-02-01 → 保存.
  - 観測: roster row 「内閣官房長官 林芳正 2023年2月1日から」.
- [x] **7. Register a new person from the picker.**
  - 手順: typed 「評価新人太郎」.
  - 観測: 「どの人物にも一致しません」 and 「新しい人物として登録」 appear. After entering よみがな and registering, the panel shows 「選択中の人物: 評価新人太郎」. Works with both Enter and a button click.
  - Also checked: empty よみがな, katakana よみがな and a name containing `<b>` are each rejected with an error.
- [x] **8. Source URL and note.**
  - 観測: the 「出典」 link points to `https://example.com/source` with `target="_blank"`, `rel="noopener noreferrer"` and `aria-label="外務大臣の出典"`. The career row on `/persons/178` shows 「テスト出典」.
- [x] **9. Invalid source URL 「abc」.**
  - 観測: 「出典URLは http:// または https:// で始まるURLを入力してください」, focus moves to sourceUrl, the roster is unchanged.
- [x] **10. Start date before the cabinet's start (2022-12-31).**
  - 観測: 「就任日は内閣の在任期間内にしてください」, nothing is added.
- [x] **11. Second 内閣官房長官 in an overlapping period.**
  - 観測: 「同じ期間にこの役職の在任者がいます」, nothing is added.
- [x] **12. Edit a row.**
  - 手順: row 編集 → the form is pre-filled → 退任日 2024-06-30, note 「テスト出典（修正後）」 → 保存.
  - 観測: the roster shows 「2024年6月30日まで」; the person page shows end date 2024年6月30日 and the new note.
- [x] **13. Delete a row.**
  - 手順: 削除 → modal `<dialog>` → 「削除する」. Esc cancels the dialog.
  - 観測: the 林芳正 row disappears from the roster, and the matching career row disappears from `/persons/23`.
- [x] **14. Data survives a restart.**
  - 手順: stopped and restarted the 3100 server.
  - 観測: the added and edited cabinet, the appointments, and the source link (`https://example.com/source`) are all still in the list and detail pages.
  - Note: I restarted the production server on the disposable DB, not the dev server (I was told not to stop the dev server). Storage is the same file DB.
- [x] **15. Regression: deleting 林芳正, who has careers.**
  - 観測: 「経歴が登録されている人物は削除できません」; the page is still there after reload.

### 権限・API・入力検証（評価の観点 2・3）
- **Write APIs** (POST `/api/cabinets`, PUT `/api/cabinets/6`, POST `.../appointments`, PUT and DELETE `.../appointments/:id`): logged-out 401, regular user 403, admin 200/201.
- **Direct URLs** (`/cabinets/new`, `/cabinets/6/edit`, `/cabinets/6/appointments/new`, edit pages):
  - Logged-out users get a 307 redirect to `/login`.
  - Regular users see 「この操作は管理者だけができます」.
- **Role injection:** a sign-up that sends `role:"admin"` still gets `role` = user.
- **Origin check:**
  - Rejected with 403 `forbiddenOrigin`: an outside Origin (JSON, text/plain and form), `Origin: null`, a look-alike host (`localhost:3100.evil.test`), and another port (3000). Sign-up from an outside Origin is also 403.
  - Allowed: the same Origin and requests with no Origin. Login works (wrong password gives 401).
- **Cabinet input:**
  - Rejected:

    | Input | Result |
    |---|---|
    | empty, spaces only, `<U+200B>` only | `nameRequired` |
    | `<U+200B>` inside the name, control character, newline, `<script>`, emoji | `nameInvalidChar` |
    | 51 characters | `nameTooLong` |
    | duplicate, including full-width digits and inserted spaces | 409 |
    | 2027-02-30, 2027-02-29, `2027/01/01` | `startDateInvalid` |
    | end date before start date | `endDateBeforeStart` |

  - Editing a cabinet so that an appointment falls outside the new period is rejected with `appointmentAfterEnd`.
- **Appointment input:**
  - Rejected source URLs: `abc`, `javascript:`, `JAVASCRIPT:`, `data:`, `file:`, `ftp:`, URLs containing a space, tab, newline or `<U+200B>`, URLs with user info, `http:///`, `https:/`, a backslash, `"` or `<>`.
  - URL length: 2000 characters is accepted; 2001 gives `sourceUrlTooLong`.
  - Rejected source notes: control characters, `<U+200B>`, `<U+202E>`, and 1001 characters.
  - Rejected: a role not on the list, a person that does not exist, a non-numeric person ID, dates outside the cabinet's period, an end date before the start date, and February 30.
- **Overlap rules:**
  - Overlapping periods for a single-holder role: 409. One day of overlap is also 409.
  - A handover where the predecessor's end date equals the successor's start date is allowed. An appointment with no start date that overlaps another is 409.
  - Overlap is allowed for the special-mission ministers (`特命担当`). The same person twice in the same role is rejected with `appointmentDuplicate`.
  - A PUT that would create an overlap is 409. A PUT that only touches its own row is 200.
- **Wrong cabinet / missing IDs:**
  - PUT or DELETE with an appointment ID from another cabinet returns 404, and the other cabinet's row is unchanged.
  - Missing cabinet or appointment: 404. Invalid ID (abc, 0, -1, 1e3): 400.
- **Roster order:**
  - Rows for the same role are ordered by start date (I inserted three 総務大臣 rows in reverse order).
  - New roles go into the standard role order (行政改革担当大臣 lands between 経済再生 and 経済安全保障).
  - The relative order of the existing seed rows did not change.
- **Seed persons:** a PUT for each of the 87 seed persons with their own data returned 200 for all 87 (on the disposable DB).

### 回帰確認
- **Sprint 1:** 内閣一覧 (cabinet list), 閣僚名簿 (roster), not-found pages (`/cabinets/99999` → 「内閣が見つかりません」 with HTTP 404) — 合格.
- **Sprint 2:**
  - Person pages and `/persons/99999` → 「人物が見つかりません」 — 合格.
  - Search: 「いしば」, then ↓ + Enter, goes to `/persons/103`; the new cabinet also shows up in search — 合格.
  - Colour scheme: cookie=dark with localStorage=light gives dark, and the reverse gives light, so the cookie takes priority — 合格.
- **Sprint 3:**
  - Sign-up through the UI gives a regular user who sees the permission error — 合格.
  - Person add / edit / delete for a person with no careers (the API returns 404 afterwards) — 合格.
  - `<script>` in a name is rejected — 合格.
  - Deleting a person with careers is refused — 合格.
- **Checks:** `pnpm lint` passes, `pnpm typecheck` passes, and `pnpm test` passes (db 62, web 19).
- **`local.db`:** only read. Still 9 cabinets, 87 persons, 177 appointments, 0 users.

### エッジケース・健全性
- **Console:** only the expected 400/409/404 responses (validation, conflicts and not-found pages). No 5xx. The 3100 server log has no exceptions.
- **No horizontal scroll:** the page width matches the viewport on 9 pages × 4 widths.
- **Shadows:** none.
- **Header height:** 165 / 109 / 109 / 61px at 375 / 768 / 1024 / 1280, as expected.
- **Contrast** (roster):
  - Light: tenure and 「出典なし」 5.33:1; names 5.99:1.
  - Dark: 16.67:1; dark-mode error text #ff6b86 on black.
- **Focus rings:** 2px solid; #0064b7 on white, white on the blue band; buttons stay pill-shaped while focused.
- **Forms:**
  - Errors use `role="alert"` and `aria-invalid`, and focus moves to the first invalid field.
  - The person page note is clamped to 2 lines at 768px and up, with a `title` attribute; at 375px the full text shows.
- **Secrets:** none appeared on screen or in API responses.

### デザイン評価（基準 7/10）
- **デザインの質: 7/10.**
  - Consistent with the black header → blue band → canvas structure; forms use the light 300-weight heading, the 「必須」 tag, hint text and error rails consistently.
  - The empty state is a panel with a light background.
  - Deduction: the 内閣を編集 / 閣僚を追加 buttons sit only 24px below the band, so the spacing is tight (`cab-empty-1280.png`).
- **オリジナリティ: 7/10.**
  - Same individual style as Sprints 1–3 (the cabinet in office is highlighted as a blue row in the list).
  - The forms match that style too: the unmatched-person panel has a blue left rail.
  - Fewer than 3 AI-slop signs.
- **クラフト: 5/10 — 閾値未達.**
  - Tenure text overlaps the source column at 768 / 1024 / 1280 (reason 1 above).
  - 「出典なし」 breaks mid-word, and the action buttons stack at 768px.
  - Everything else is tidy: no horizontal scroll, column alignment holds (the only offset is the highlighted current-cabinet row, which is deliberate), no shadows.
- **機能性: 7/10.**
  - Every operation can be completed with the keyboard.
  - Deductions:
    - The person field is `role="combobox"`, but ↓ / Enter do not move through or pick candidates; you have to Tab to them. This differs from the header search, which does support arrow keys.
    - After picking a person, registering one, or deleting a row, focus falls back to `body`.

### 再テスト対象（次回、最初に確認する項目）
- Add a row with both 就任日 and 退任日 on `/cabinets/:id`. At 768 / 1024 / 1280px, as admin and logged-out, check that the tenure text stays inside its cell (text right edge ≤ cell right edge) and does not overlap the 出典 column.
- At 768px admin, 「出典なし」 does not break mid-word and 編集 / 削除 stay on one line.

### 改善提案（任意・FAIL の理由ではない）
- Make the person picker's ↓ / Enter work like the header search, and keep focus on the 「選び直す」 button after picking or registering a person.
- After deleting a row, move focus to the roster heading.
- A cabinet start date of `0000-01-01` is accepted (`isRealDate` allows year 0000); consider a lower bound such as 1885.
- In the cabinet list, a cabinet with no 内閣総理大臣 leaves that cell empty. Consider showing a placeholder such as 「—」.
- 「林　芳正」 (with a full-width space) is registered as a separate person from 「林芳正」, and searching for it does not hit 林芳正. This matches the Sprint 3 rules and is a spec decision.
- A deleted appointment's edit URL (`/cabinets/6/appointments/180/edit`) shows 「内閣が見つかりません」, but the cabinet exists. A message like 「人事が見つかりません」 would be more accurate.
- Unknown URLs (`/nope`) show Next.js's English default 「This page could not be found.」. A Japanese root `not-found.tsx` would fit the next-intl rule.
- Repeated from earlier rounds: make 「キャンセル」 the initial focus in the delete dialog, and reflect `warning-ink` in DESIGN.md.

### 評価に使ったデータ・環境（後片付け用）
- **Disposable DB:** `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s4.db`.
  - Accounts: `s4admin@eval.example.test` (admin), `s4user@`, `s4role@` and `s4ui@eval.example.test`.
  - Cabinets: id 10 「評価日付内閣」 and id 11 「評価追加内閣　改」.
  - Persons: 評価新人太郎, 評価花子, 林　芳正 (full-width space).
  - Appointments: test rows in cabinets 6 and 11.
- **Production server on 3100:** stopped. The dev server on 3000 is still running and responds 200.
- **`apps/web/next-env.d.ts`:** `pnpm build` rewrote it (`.next/dev/types` → `.next/types`), so it shows as modified. Please run `git checkout apps/web/next-env.d.ts` in the main session (I did not change it back because I'm not allowed to write).
- **Repository:** no images were saved there; screenshots are in the scratchpad. The Playwright MCP wrote its usual snapshot and console logs to `/home/user/Japan_Politics/.playwright-mcp/`.
- **Screenshots** (in `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/`):
  - `cab11-table-1024.png`
  - `cab11-table-768-anon.png`
  - `cab11-table-1280.png`
  - `r-cab11-768.png`
  - `cab-empty-1280.png`
  - `delete-dialog-1280.png`
  - `dark-dialog.png`

VERDICT: FAIL
RETURN_TO: designer
