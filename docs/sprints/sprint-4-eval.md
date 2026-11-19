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

---

## 試行 2

VERDICT: FAIL
RETURN_TO: designer

## Evaluator 判定: 不合格 (Sprint 4 / 試行 2)

前回の不合格項目（在任の文字が出典の列に重なる、「出典なし」が語の途中で折れる、768px で編集 / 削除が縦に積まれる）は、すべて数値で直ったことを確認しました。契約 15 項目、権限、入力検証、Sprint 1〜3 の回帰もすべて合格です。

ただし、今回の列幅の配分変更（管理者の役職の列を 24% → 18%）で、新しい退行が出ています。初期データの役職名が、管理者表示の 900px と 1024px で 1 文字だけ次の行に落ちるようになりました（例:「国家公安委員会委員／長」）。768px では折れ方が悪化しています。試行 1 で「出典な／し」を不合格にしたのと同じ種類の欠陥なので、クラフトが基準 7 を下回ります。機能はすべて合格のため、戻し先は designer です。

### 不合格理由（重大な順）

#### 1. 管理者の閣僚名簿で、役職名が語の途中で折れる（今回の修正による退行）

**実際**（`/cabinets/1`〜`9` の初期データ、管理者でログイン）

| 幅 | 今回の列幅で出る折れ | 試行 1 の列幅（24/20/20/12/24%）を画面上で当てた場合 |
|---|---|---|
| 1024px | 「国家公安委員会委員／長」「経済安全保障担当大／臣」 | 折れなし |
| 900px | 「国家公安委員会／委員長」「行政改革担当大／臣」「経済再生担当大／臣」「経済安全保障担／当大臣」「少子化対策担当／大臣」 | 折れなし |
| 768px / 800px | 「国家公安委員／会委員長」「少子化対策担／当大臣」「行政改革担当／大臣」「経済再生担当／大臣」「経済安全保障／担当大臣」 | 768px:「国家公安委員会委／員長」「少子化対策担当大／臣」「経済安全保障担当／大臣」 |

- 1280px では折れません。未ログインと一般ユーザーの表示（34% の列）でも折れません。
- 証拠（1024px）: `t2-cab6-1024-admin-role.png`（坂井学の行。「長」が 1 文字だけ 2 行目）と `t2-1024-admin-role2.png`（城内実の行。「臣」が 1 文字だけ 2 行目）。この 2 行は在任が空で、隣の在任の列（27% = 251px）はがら空きです。
- 768px の画面: `t2-cab10-admin-768.png`（「国家公安委員／会委員長」「経済安全保障／担当大臣」）。

**再現手順**
1. 管理者でログインする。
2. 幅 1024px で `/cabinets/6` を開く。
3. 国家公安委員会委員長の行と経済安全保障担当大臣の行を見る。

**期待:** 900 / 1024 / 1280px では、初期データの役職名と氏名が折れない。768px でも、1〜2 文字だけ次の行に落ちる折れ方や、氏名の途中での折れが出ない。

**原因:** `apps/web/src/app/cabinets/[id]/page.tsx` で、管理者の役職の列を 24% → 18%、在任の列を 20% → 27% にした。
- 1024px での役職の列は幅 167px、文字の入る幅は約 151px。
- 最長の役職名「国家公安委員会委員長」は、16px で 163px 必要。
- 一方、在任は 2 行に折る作りになったので、必要なのは 1 行分（「2026年10月21日から」）の 136px だけ。在任の列の 27% は取りすぎです。

**修正指示（designer）**
- 管理者の列幅を、例えば 役職 22% / 氏名 19% / 在任 21% / 出典 14% / 操作 24% に配り直す。1024px（表の幅 928px）では、役職の文字幅 188px ≥ 163px、在任の文字幅 163px ≥ 136px、出典の文字幅 98px ≥「出典なし」になります。
- 768px（表の幅 672px）では、必要な幅の合計が約 748px で入りきりません。役職のセルに `lang="ja"` と `word-break: auto-phrase` を指定して文節で折る、などの方法で、1 文字だけ落ちる折れ方を避けてください。
- 修正後は 768 / 800 / 900 / 1024 / 1280px、管理者と未ログインの両方で、`/cabinets/1`〜`9` の役職と氏名、それに在任の 4 パターン（両方あり・就任日のみ・退任日のみ・空）を確認してください。

**戻し先:** designer

#### 2. （同じ原因・既存）768 / 800px の管理者で、初期データの氏名「三原じゅん子」が「三原じゅん／子」と折れる

- 氏名の列は幅 128px、文字の入る幅は 96px。この氏名は 18px で 108px 必要です。
- 試行 1 の 20% でも、計算上は同じく折れます（今回の 19% で始まったものではありません）。ただし、指示された「氏名が途中で折れる退行がない」の確認対象なので、1 と一緒に直してください（850px 以上では折れません）。
- 証拠: `t2-cab6-768-admin-mihara.png`
- 戻し先: designer

### 前回の不合格項目の再テスト（すべて合格）

使い捨て DB の内閣 10（評価T2内閣）に、在任の 4 パターンと最長の日付の行を入れて測りました。
- 両方あり:「2023年1月1日から2023年2月1日まで」「2026年10月21日から2026年12月31日まで」「2026年11月30日から2026年12月31日まで」
- 就任日のみ・退任日のみ・空

**在任の文字の右端 ≤ セルの右端、隣の列の文字と接しない（全部 0 件）**
- 対象: 768 / 800 / 900 / 1024 / 1100 / 1280 / 1440px × 未ログイン・一般ユーザー・管理者 × `/cabinets/1`〜`10`。
- 2 行に折れるときは、どれも「から」の後ろで「…から」と「…まで」に分かれます。
- 管理者 1280px と未ログイン 1280px の 2023 年の行は 1 行に収まります。

**768px の管理者**
- 「出典なし」の折れ: 0 件。
- 編集 / 削除の上端のずれ: 0 件（1 行に並ぶ）。
- 見出しとセルの文字の左端は ±1.5px 以内で一致。

**50 文字の氏名**
- 管理者 768px で 10 行に折れ、右端 276.6px ≤ セルの右端 296.6px で、はみ出しません。

**375px のカード表示**
- 未ログイン・管理者、ライト・ダークのすべてで、カードの幅 327px からはみ出す要素は 0、横スクロールなし。
- 証拠: `t2-cab10-admin-375.png`

**人物ページ `/persons/1`〜`180`（768px）と内閣一覧 `/`（768〜1440px）**
- はみ出し・日付の折れは 0 件。
- 人物ページは 768 / 1024px で、試行 1 の列幅と比べて新しい折れはありません。
- `/` の 1 行目だけ文字の左端が 16px ずれますが、これは試行 1 で確認済みの、在任中の内閣の青い行の意図的な字下げです（2 行目以降は一致）。

### スプリント契約

**評価環境**
- 本番ビルドをポート 3100 で起動し、使い捨て DB `eval-s4-t2.db` を使った。
- 管理者は `t2admin@eval.example.test`（`pnpm admin:grant` で付与、終了コード 0）。一般ユーザーは `t2user@eval.example.test`。

**各項目**

- [x] **1. 管理者用のボタンが出ない** — 未ログインと一般ユーザーで、`/`、`/cabinets/6`、`/cabinets/9` に「内閣を追加」「内閣を編集」「閣僚を追加」「編集」「削除」が 0 件。「操作」の列も無い。管理者には「内閣を追加」が出る。
- [x] **2. 発足日順の位置** — 「評価T2内閣」（2023-01-01）が、第2次岸田第2次改造内閣（2023-09-13）と第2次岸田改造内閣（2022-08-10）の間に出た。
- [x] **3. 閣僚のいない内閣** — `/cabinets/10` に「登録された閣僚はいません」と出た。
- [x] **4. 内閣名が空** — 「内閣名は必須です」と出て、内閣は 9 件のまま。
- [x] **5. 終了日が発足日より前** — 2027-04-01 / 2027-03-31 で「終了日は発足日以降の日付にしてください」と出て、追加されない。
- [x] **6. 既存の人物で閣僚を追加** — 「芳正」で候補「林芳正 はやしよしまさ」を選び、就任日 2023-02-01 で保存。名簿に「内閣官房長官 林芳正 2023年2月1日から」の行が出た。
- [x] **7. 新しい人物の登録** — 「評価T2新人」と入力すると「どの人物にも一致しません」「新しい人物として登録」が出た。よみがなを入れて登録すると「選択中の人物: 評価T2新人」になった。
- [x] **8. 出典 URL と出典メモ** — 「出典」リンクは `href=https://example.com/source`、`target=_blank`、`rel="noopener noreferrer"`。`/persons/178` の経歴の行に「テスト出典」が出た。
- [x] **9. 出典 URL「abc」** — 指定の文言が出て、フォーカスが出典 URL の欄に移った。名簿は 1 行のまま。
- [x] **10. 就任日 2022-12-31（発足日より前）** — 「就任日は内閣の在任期間内にしてください」と出た。
- [x] **11. 2 人目の内閣官房長官** — 「同じ期間にこの役職の在任者がいます」と出て、行は増えない。
- [x] **12. 行の編集** — フォームには既存の値が入っている。退任日を 2024-06-30、出典メモを「テスト出典（修正後T2）」に変えて保存した。
  - 名簿の表示:「2023年2月1日から2024年6月30日まで」
  - `/persons/23` の経歴の行: 退任日「2024年6月30日」とメモ「テスト出典（修正後T2）」
- [x] **13. 行の削除** — 削除ダイアログは modal の `<dialog>` で、Esc で閉じる（行は残る）。「削除する」で名簿の行が消え、`/persons/23` の評価T2内閣の経歴の行も消えた。
- [x] **14. 再起動後も残る** — 3100 のサーバーを停止して起動し直した。
  - `/` に評価T2内閣が出る。
  - `/cabinets/10` に評価T2新人、出典 `https://example.com/source`、各日付、「テスト出典」が出る。
  - `/persons/178` にも「テスト出典」が出る。
  - 開発サーバーではなく本番サーバーで確認した（開発サーバーは停止しない指示のため）。DB は同じファイル方式。
- [x] **15. 回帰: 経歴のある人物の削除** — 林芳正の「削除」で「経歴が登録されている人物は削除できません」と出た。再読み込み後も h1 は林芳正。

### 権限・入力検証（試行 1 で合格済みの項目が壊れていないこと）

**書き込み API**（POST 内閣、PUT 内閣、POST 人事、PUT 人事、DELETE 人事）

| 呼び出し元 | 結果 |
|---|---|
| 未ログイン | すべて 401 |
| 一般ユーザー | すべて 403 |
| 管理者 + 外部 Origin | すべて 403 |
| 管理者 + Origin なし | 201 / 200 |
| 管理者 + 別の内閣の人事 ID で削除 | 404 |

**入力の拒否**

| 入力 | 結果 |
|---|---|
| 出典 URL `abc`、`javascript:alert(1)`、空白を含む URL、`ftp:` | `sourceUrlInvalid` |
| 2023-02-30 | `startDateInvalid` |
| 存在しない人物 | `personNotFound` |
| 一覧にない役職 | `postInvalid` |
| 内閣名 `<script>` | `nameInvalidChar` |

**直接 URL**（`/cabinets/new`、`/cabinets/10/edit`、`.../appointments/new`、`.../appointments/181/edit`）
- 未ログインは 307 で `/login` へ。
- 一般ユーザーには「この操作は管理者だけができます」が出る。

**その他**
- 編集 / 削除に `aria-describedby="roster-row-178"` が付いている（参照先の文字は「内閣官房長官」）。
- 出典リンクの `target` / `rel` は上記のとおり。

### 回帰確認
- **Sprint 1:**
  - 内閣一覧と名簿が表示される。
  - `/cabinets/99999` は HTTP 404 で「内閣が見つかりません」。
- **Sprint 2:**
  - `/persons/99999` は HTTP 404 で「人物が見つかりません」。
  - 検索欄で「いしば」→ ↓ + Enter で `/persons/103` に移る。
  - `/cabinets/7` に加藤勝信が出る。
- **Sprint 3:**
  - 画面から登録した `t2ui@eval.example.test` は一般ユーザーになり、ヘッダーに「人物を追加」が出ない。
  - `/persons/new` で権限エラーが出る。
  - 経歴のある人物の削除は拒否される。
- **検証コマンド:** `pnpm lint` 合格、`pnpm typecheck` 合格、`pnpm test` 合格（db 62 件、web 19 件）、`pnpm build` 成功。
- **`local.db`:** 読み取りだけ。cabinets 9、persons 87、cabinet_appointments 177、user 0、session 0 のまま。

### エッジケース・健全性
- **コンソール:** 出たのは想定どおりの 400 / 409 だけ（409 は項目 15 の拒否）。5xx なし。
- **横スクロール:** すべての幅でなし。
- **影:** box-shadow 0 件。
- **ヘッダーの高さ:** 375 / 768 / 1024 / 1280px で 165 / 109 / 109 / 61px。
- **文字のコントラスト:**
  - ライト（白地）: 在任と「出典なし」5.33:1、氏名 5.99:1、見出し 5.33:1。
  - ダーク（黒地）: 在任と出典 16.67:1、氏名 9.10:1。
- **フォーカス枠:** 2px solid。ライトは #0064b7、ダークは #53b1ff（黒地に 9.10:1）。フォーカス中も丸い形のまま。
- **シークレット:** 画面にも API の応答にも出ていない。

### デザイン評価（基準 7/10）
- **デザインの質: 7/10**
  - 黒ヘッダー → 青い帯 → キャンバスの構成が一貫している。
  - 管理ボタン群の上余白が 40px になり、帯との詰まりが解消した（`t2-cab10-admin-768.png`）。
  - 在任が「…から」「…まで」の 2 行で揃い、読みやすい。
- **オリジナリティ: 7/10**
  - Sprint 1〜3 と同じ個性（青い帯、在任中の内閣を青い行で強調、細い罫線の表）。
  - AI スロップの兆候は 3 つ未満。
- **クラフト: 6/10 — 基準未達**
  - 良くなった点: 在任の重なりは 0 件。「出典なし」は折れない。編集 / 削除は 1 行。列の整列も保たれ、375px も崩れない。
  - 減点: 不合格理由 1 の、管理者 900 / 1024px で役職名が 1 文字だけ次の行に落ちる退行（初期データ。在任の列は 27% あって、在任が空の行ではがら空き）。768px で折れ方が悪化した点と、「三原じゅん／子」も減点。
- **機能性: 7/10**
  - キーボードで全操作ができる。ダイアログは modal で、Esc で閉じる。
  - 減点（見送り済みのもの）: 人物欄で ↓ / Enter が候補に効かない。操作のあとフォーカスが `body` に落ちる。

### 再テスト対象（次回、最初に確認する項目）
- 管理者で 768 / 800 / 900 / 1024 / 1280px の `/cabinets/6`、`/cabinets/7` などを開き、次のように折れないことを確認する。
  - 「国家公安委員会委員長」「経済安全保障担当大臣」「少子化対策担当大臣」「行政改革担当大臣」「経済再生担当大臣」が 1 文字だけ落ちない。
  - 「三原じゅん子」が途中で折れない。
- 同じ幅で、在任の 4 パターンと最長の日付（`2026年10月21日から2026年12月31日まで`）が、セルからはみ出さず出典の列に重ならないこと（今回の合格状態が保たれていること）。

### 改善提案（FAIL の理由ではない）
- **375px のカード表示:** 在任が編集 / 削除のボタンの下に来て、氏名から離れている（`max-md:order-last`。試行 1 から同じ）。管理者のときは、在任を氏名のすぐ下に置くほうが読みやすい。
- **見送り済みの項目の再掲:**
  - 人物欄の ↓ / Enter の操作。
  - 操作のあとのフォーカスの戻し先。
  - 削除ダイアログの初期フォーカスを「キャンセル」に。
  - 発足日 `0000-01-01` が通る。
  - ルートの not-found を日本語に。
  - `warning-ink` を DESIGN.md に反映する（ユーザーの承認が必要）。

### メインセッションへの連絡（後片付け）
- **`apps/web/next-env.d.ts`:** 私の `pnpm build` が書き換えたもの（`.next/dev/types` → `.next/types`）が、評価中にメインセッションが作ったコミット `0cc864d`（「Sprint 4: designer 修正…」）に入っています。元の `.next/dev/types/...` に戻してください。私は書き込みできないので戻していません。
- **使い捨て DB:** `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s4-t2.db`
  - アカウント: `t2admin@`（管理者）、`t2user@`、`t2ui@eval.example.test`。
  - 内閣: id 10「評価T2内閣」、id 11「x」（Origin なしの API 確認で作成）。
  - 人物: 178「評価T2新人」、179（「長」が 50 文字）、180「評価長氏名右衛門之助」。
  - 人事: 内閣 10 の試験用の行、文部科学大臣（人物 2）。
  - Cookie ファイル: `ck-t2admin-t2.txt`、`ck-t2user-t2.txt`（同じ scratchpad 内）。
- **サーバー:** 3100 は停止済み（応答なしを確認）。3000 の開発サーバーは動いたまま（200）。
- **リポジトリ:** 画像は保存していません。Playwright MCP のブラウザは今回使っていません（Node の Playwright を標準入力から実行）。
- **スクリーンショット**（`/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/`）
  - `t2-cab6-1024-admin-role.png`
  - `t2-1024-admin-role2.png`
  - `t2-cab6-768-admin-mihara.png`
  - `t2-cab10-admin-768.png`
  - `t2-cab10-anon-1024.png`
  - `t2-cab10-admin-dark-1280.png`
  - `t2-cab10-admin-375.png`
  - `t2-delete-dialog-768.png`
  - その他 `t2-cab10-{admin,anon,admin-dark,anon-dark}-{375,768,1024,1280}.png`

VERDICT: FAIL
RETURN_TO: designer
