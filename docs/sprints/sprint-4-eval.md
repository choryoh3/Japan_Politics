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

---

## 試行 3

VERDICT: FAIL
RETURN_TO: designer

## Evaluator 判定: 不合格 (Sprint 4 / 試行 3)

試行 2 で落ちた点（管理者の名簿で役職名・氏名が 1 文字だけ次の行に落ちる）は直っています。数値で走査して 0 件でした。契約 15 項目、権限、入力検証、Sprint 1〜3 の主要な回帰もすべて合格です。

ただし、試行 2 の修正（コミット `0cc864d`）で **Sprint 1 で直した「在任の日付が途中で折れない」が壊れていました**。未ログインと一般ユーザーの 768〜799px で、日付が 1 つだけの在任が「…ま／で」「…か／ら」と 1 文字だけ次の行に落ちます。試行 2 では見落としていました。

不合格になる 1 件と、同じ種類（文字の折れ・はみ出し）の問題を下にまとめます。

戻し先について: 規則では回帰は generator に戻しますが、原因は designer が外したスタイルの 1 クラスだけで、機能は変わりません。generator にはデザインの修正をさせない決まりがあるため、designer に戻します。

### 不合格理由（重大な順）

**1. 回帰（Sprint 1 で合格した項目）: 在任の日付が「ま／で」「か／ら」と 1 文字だけ折れる**
- 起きる条件: 未ログインと一般ユーザー、768〜799px、ライトとダークの両方。
- 起きる行: 初期データの名簿で、日付が 1 つだけの在任（「…から」だけ、または「…まで」だけ）。
- 件数: 18 行。
  - `/cabinets/4`: 8 行。例:「2022年11月21日ま／で」「2022年11月21日か／ら」「2022年11月11日ま／で」「2022年12月27日か／ら」「2022年10月25日ま／で」。
  - `/cabinets/5`: 8 行。例:「2023年12月14日ま／で」「2023年12月14日か／ら」。
  - 使い捨て DB の `/cabinets/11`: 2 行。
- 幅ごとの件数（`/cabinets/4`）: 768 / 770 / 775 / 780 / 785 / 790 / 795px で 8 件、800px で 0 件。
- 比較: 同じ幅でも、日付が 2 つある在任（「2026年10月21日から」＋「2026年12月31日まで」）は正しく 2 行に分かれています。同じ表の中で、行ごとに折れ方が違って見えます。
- 証拠:
  - `t3-cab4-anon-768-tenure.png`（松野博一・寺田稔などの行）
  - `t3-cab11-anon-light-768.png`（三原じゅん子「2026年12月31日ま／で」、加藤勝信「2026年10月21日か／ら」）
- 反している要求: Sprint 1 の判定記録（試行 4 → 5）で直した項目です。「At 768 and 1024, 在任 cells in /cabinets/1, /4, /5 and /7 must not break mid-date」とあり、試行 5 で「Every 在任 cell is on one line」として合格しています。
- 原因: コミット `0cc864d`（Sprint 4 試行 2 の designer 修正）。
  - 在任の `<td>` から `md:whitespace-nowrap` を外した。
  - `whitespace-nowrap` の span で囲んだのは、日付が 2 つある場合だけだった。
  - `apps/web/src/app/cabinets/[id]/page.tsx` の `tenureText` の 47〜48 行目、`if (row.startDate) return t("tenureFrom", …)` と `if (row.endDate) return t("tenureUntil", …)` は、素の文字列を返したまま。
  - そのため、在任の列（24%、161〜168px）で 1 文字だけ落ちる。
- 修正指示: 同じファイルの `tenureText` で、日付が 1 つだけの 2 つの分岐も `<span className="whitespace-nowrap">…</span>` で返す。
  - 日付が 2 つある場合と同じ作りにします。
  - 日付が 2 つある場合の span は今もセルからはみ出していないので（後述の走査で 0 件）、同じ幅で収まります。
- 再テスト: 未ログインで 768 / 780 / 799 / 800 / 1024px の `/cabinets/1`, `/4`, `/5`, `/7` と、4 パターンの在任がある内閣を開く。在任の各行が、正規表現 `^(\d{4}年\d{1,2}月\d{1,2}日(から|まで))+$` に合うこと。
- 戻し先: designer

**2. 同じ種類の問題（今回あわせて直すこと）: 管理者が登録した内閣名が折れずに、はみ出す・隣の列に重なる・切れる**
- 原因の箇所: `apps/web/src/components/cabinet-name.tsx` が `[word-break:keep-all]` を使い、「第N次」「改造」の前にしか折り返し候補を入れていない。
- 影響: Sprint 4 から管理者が自由に入れられる内閣名（50 文字まで）で、このパターンに当てはまらないものは、どこでも折れない。
- 9 文字の「評価T3長日付内閣」:
  - 768px の `/persons/N`（所属の列）で、文字が 15px はみ出す。
  - 文字の右端が 298px、隣の就任日「2026年10月21日」の左端が 299px で、すき間は 1px しかない。見た目は文字がくっついている。
  - 証拠: `t3-person2-768.png`
  - 対象の人物は 2 / 23 / 78 / 103 / 121 / 178（使い捨て DB）。
- 24 文字の「評価T3とても長い内閣名の表示確認用テスト内閣」:
  - `/cabinets/12` の h1 は、375 / 768 / 1024px で画面の外に切れる。文字の右端は 711 / 1207 / 1207px（`overflow-x: clip` のため、横スクロールではなく見えなくなる）。
  - 証拠: `t3-longname-cab12-375.png`
  - `/` では、768px で内閣名が発足日の列に重なる。
  - 証拠: `t3-longname-list-768-table.png`
  - 375 / 1280px の `/` と `/persons/N` でもセルからはみ出す。
- 補足:
  - 仕様では内閣名は首相官邸の表記に合わせるので、現実の名前は多くの場合このパターンに当てはまります。
  - ただし入力欄は任意の名前を受け付けるので、見た目が壊れない作りが必要です。
  - 単独で不合格にする問題ではありませんが、次のループで「もぐらたたき」にならないよう、今回の修正に含めてください。
- 修正指示: `cabinet-name.tsx` の span に `[overflow-wrap:anywhere]` を足す（`keep-all` は残す）。
  - こうすると、収まる名前は今までどおり語の途中で折れません。
  - 収まらないときだけ、文字の間で折れます。
  - 初期データの内閣名の折れ方は変わらないはずです。`/` と各 `/cabinets/N` の h1 で確認してください。
- 再テスト: 9 文字と 24 文字の内閣名で、375 / 768 / 1024 / 1280px の `/`、`/cabinets/N` の h1、`/persons/N` の所属の列を開き、文字の右端がセルの右端以下であること。
- 戻し先: designer

**3. 推奨（単独では不合格の理由にしない。クラフトの減点に含めた）: 管理者のカード表示で、在任が空の行だけ「出典」の位置が変わる**
- 768〜1023px と 375px の管理者のカードで起きる。
  - 在任が空の行（例: 総務大臣 林芳正）: 「出典なし」が氏名と同じ行の右端に出る。
  - それ以外の行: 出典が独立した行の左端に出る。
- 証拠: `t3-cab11-admin-light-768.png` の 1 行目と 2 行目以降。
- 原因: 試行 3 で `order-last` を外した。在任の `w-full` が出典を次の行に押し出す。在任が空だと `empty:hidden` で押し出されない。
- 修正案: 管理者の `sourceCellClass` を `"max-lg:w-full max-lg:p-0"` にして、出典を常に独立した行にする。

### 前回（試行 2）の不合格項目の再テスト: 合格

**方法**
- 本番ビルドをポート 3100 で起動し、使い捨て DB を使った。
- Node の Playwright で機械的に走査した。各文字の位置（Range）から行を組み立てて数えた。
- 走査が折れを検出できることも確かめた。役職の列を 5% に絞ると「国家／公安／委員／会委員／員長」を検出した。

**走査の範囲**
- 幅: 375 / 768 / 800 / 850 / 900 / 1000 / 1023 / 1024 / 1100 / 1280 / 1440px
- 内閣: `/cabinets/1`〜`11`
- 組み合わせ: 管理者のライトとダーク、未ログインのライトとダーク、一般ユーザーのライト
- 各組み合わせで 2,024 行を確認した。

**結果**
- 役職名・氏名の折れは 0 件（すべての組み合わせ）。
  - 「国家公安委員会委員長」「経済安全保障担当大臣」「少子化対策担当大臣」「行政改革担当大臣」「経済再生担当大臣」「三原じゅん子」を含む。
- 在任・出典・操作がセルからはみ出す件数、在任と出典の文字の重なり、横スクロールも、すべて 0 件。
- 在任の折れは、管理者では 0 件。未ログインと一般ユーザーでは、不合格理由 1 の 18 件だけ（768px のみ）。
- 表示の切り替わり: 管理者は 1023px でカード（`display:block`）、1024px で表（`table`）。一般ユーザーと未ログインは 768px から表。

### 管理者のカード表示（768〜1023px）と 375px

数値の結果（0 件）は、上記の走査の範囲すべてについてです。
- 並び: 役職 → 氏名 → 在任 → 出典 → 編集・削除。
- 見た目の順と Tab 順（氏名 → 出典 → 編集 → 削除）の食い違い: 0 件。
- 編集と削除は 1 行に並ぶ（食い違い 0 件）。
- フォーカスできる要素の高さが 44px 未満のもの: 0 件。
- 「出典なし」が折れる件数: 0 件。
- 管理者の 375px のカードで、在任は氏名のすぐ下にある（判定の失敗 0 件）。
- 1023px と 1024px の切り替わりで崩れはない。1024px の列幅は 役職 204 / 氏名 176 / 在任 195 / 出典 130 / 操作 223px。
- 証拠: `t3-cab11-admin-light-1024.png`、`t3-cab11-admin-dark-375.png`、同じフォルダの `t3-cab11-{admin,anon}-{light,dark}-{375,768,1023,1024,1280}.png`

### スプリント契約

**評価環境**
- 本番ビルドをポート 3100 で起動し、使い捨て DB `eval-s4-t3.db`（scratchpad）を使った。
- 管理者は `t3admin@eval.example.test`。API で登録したあと `pnpm admin:grant` で付与した（出力「t3admin@eval.example.test を管理者にしました」、終了コード 0）。
- 一般ユーザーは `t3user@eval.example.test`。

**各項目**
- [x] **1. 管理者用のボタンが出ない** — 未ログインと一般ユーザーで、`/`、`/cabinets/6`、`/cabinets/9` に「内閣を追加」「内閣を編集」「閣僚を追加」「編集」「削除」と「操作」の列が 0 件。管理者では `/` に「内閣を追加」が 1 件、`/cabinets/6` に「編集」と「削除」が各 19 件。
- [x] **2. 発足日順の位置** — 「評価T3内閣」（2023-01-01）が、第2次岸田第2次改造内閣（2023-09-13）と第2次岸田改造内閣（2022-08-10）の間に出た。
- [x] **3. 閣僚のいない内閣** — `/cabinets/10` に「登録された閣僚はいません」と出た。
- [x] **4. 内閣名が空** — 「内閣名は必須です」と出て、一覧は 9 件のまま。
- [x] **5. 終了日が発足日より前** — 2027-04-01 / 2027-03-31 で「終了日は発足日以降の日付にしてください」と出て、追加されない。
- [x] **6. 既存の人物で閣僚を追加** — 「芳正」で候補「林芳正 はやしよしまさ」を選び、就任日 2023-02-01 で保存。名簿に「内閣官房長官 林芳正 2023年2月1日から」の行が出た。
- [x] **7. 新しい人物の登録** — 「評価T3新人」と入力すると「どの人物にも一致しません」と「新しい人物として登録」が出た。よみがなを入れて登録すると「選択中の人物: 評価T3新人」になった。
- [x] **8. 出典 URL と出典メモ** — 「出典」リンクは `href=https://example.com/source`、`target=_blank`、`rel="noopener noreferrer"`、`aria-label`「内閣官房長官の出典」。`/persons/23` の経歴の行に「テスト出典」が出た。
- [x] **9. 出典 URL「abc」** — 指定の文言が出て、フォーカスが `#sourceUrl` に移った。名簿は 1 行のまま。
- [x] **10. 就任日 2022-12-31** — 「就任日は内閣の在任期間内にしてください」と出た。
- [x] **11. 2 人目の内閣官房長官** — 加藤勝信を 2023-03-01 で追加しようとすると「同じ期間にこの役職の在任者がいます」と出て、行は 1 のまま。
- [x] **12. 行の編集**
  - フォームには既存の値が入っている（内閣官房長官 / 2023-02-01 / URL / テスト出典）。
  - 退任日を 2024-06-30、出典メモを「テスト出典（修正後T3）」に変えて保存した。
  - 名簿の表示:「2023年2月1日から2024年6月30日まで」。
  - `/persons/23` の経歴の行に、2024年6月30日と「テスト出典（修正後T3）」が出た。
- [x] **13. 行の削除**
  - ダイアログは modal（`:modal` が true）。本文は「内閣官房長官の林芳正の人事を削除します。…」。
  - Esc で閉じ、行は残る。
  - 「削除する」で行が消え、`/persons/23` の評価T3内閣の行も 0 件になった。
  - 編集・削除の `aria-describedby` は `roster-row-178` で、参照先の文字は「内閣官房長官」。
- [x] **14. 再起動後も残る** — 3100 のサーバーを 2 回止めて起動し直した。止めている間は応答なし（000）を確認した。
  - 1 回目: 追加した内閣 2 件、人事、出典 URL、「テスト出典」「修正後T3」が残っていた。
  - 2 回目: その前に画面から行った内閣の修正（「評価T3長日付内閣改」、終了日 2027-03-31）と、人事の修正（URL `https://example.com/restart`、メモ「再起動確認メモT3」）が、`/`、`/cabinets/11`、`/persons/178` に残っていた。
  - 開発サーバーではなく本番サーバーで確認した（3000 は停止しない指示のため）。
- [x] **15. 回帰: 経歴のある人物の削除** — 林芳正の「削除」→「削除する」で「経歴が登録されている人物は削除できません」と出た。再読み込み後も h1 は「林芳正」。

### 権限・入力検証

**書き込み API**（POST 内閣、PUT 内閣、POST 人事、PUT 人事、DELETE 人事）

| 呼び出し元 | 結果 |
|---|---|
| 未ログイン | すべて 401 |
| 一般ユーザー | すべて 403 |
| 管理者 + Origin `https://evil.example.test` | すべて 403 |
| 管理者 + Origin なし | 201 / 200 / 201 / 200 |
| 管理者 + 別の内閣の人事 ID で削除 | 404 |

**入力の拒否**（すべて 400）

| 入力 | 結果 |
|---|---|
| 出典 URL `abc`、`javascript:alert(1)`、`ftp://…` | `sourceUrlInvalid` |
| 2023-02-30 | `startDateInvalid` |
| 存在しない人物 | `personNotFound` |
| 一覧にない役職 | `postInvalid` |
| 内閣名 `<script>` | `nameInvalidChar` |

**直接 URL**（`/cabinets/new`、`/cabinets/10/edit`、`…/appointments/new`、`…/appointments/179/edit`）
- 未ログインは 307 で `/login` へ。
- 一般ユーザーには「この操作は管理者だけができます」が出る。

### 回帰確認

不合格理由 1 は、Sprint 1 の項目の回帰です。そのほかは次のとおり合格です。

- **Sprint 1:** `/cabinets/99999` は 404 で「内閣が見つかりません」。一覧と名簿が表示される。
- **Sprint 2:**
  - `/persons/99999` は 404 で「人物が見つかりません」。
  - 「いしば」→ ↓ + Enter で `/persons/103`（石破茂）に移る。
  - `/cabinets/7` に加藤勝信が出る。
- **Sprint 3:**
  - 画面から登録した `t3ui@eval.example.test` は一般ユーザーになり、ヘッダーに「人物を追加」が出ない。
  - `/persons/new` で権限エラーが出る。
- **人物ページ `/persons/1`〜`181`**（375 / 768 / 1024 / 1280px、88 人 × 4 幅）: 初期データの日付の折れ・はみ出しは 0 件。はみ出したのは、不合格理由 2 の、自分で作った内閣名の行だけ。
- **内閣一覧 `/`**（768 / 800 / 850 / 900 / 1024 / 1100 / 1280 / 1440px、ライトとダーク）: 0 件。
- **検証コマンド:** `pnpm lint`、`pnpm typecheck`、`pnpm test`（db 62 件、web 19 件）、`pnpm build` はすべて合格・成功。
- **`local.db`:** 読み取りだけ。cabinets 9、persons 87、cabinet_appointments 177、user 0、session 0 のまま。

### エッジケース・健全性
- **コンソール:** 出たのは、想定どおりの 400（入力の拒否）と 409（役職の重なり、経歴のある人物の削除）だけ。表示確認の巡回ではエラー・警告とも 0 件。5xx なし。
- **横スクロール:** すべての幅でなし。
- **影:** box-shadow 0 件。
- **ヘッダーの高さ:** 375 / 768 / 1023 / 1024 / 1280px で 165 / 109 / 109 / 109 / 61px。
- **フォーカス枠:** 2px solid、outline-offset 3px。ライトは #0064b7、ダークは #53b1ff。
  - 編集・削除はフォーカス中も丸い形（border-radius 9999px）。
- **文字のコントラスト**（ライトは白地、ダークは黒地。半透明の色は背景と合成して計算）:

| 文字 | ライト | ダーク |
|---|---|---|
| 在任 | 5.33:1 | 約 5.2:1 |
| 役職 | 約 5.7:1 | 約 10:1 |
| 氏名 | 5.99:1 | 9.10:1 |

- **シークレット:** 画面にも API の応答にも出ていない。
- **長い入力:**
  - 長い人物名「評価T3長い氏名テスト用の長い名前です右衛門之助」、長い URL、長い出典メモは、375〜1280px で折れて収まった（はみ出し 0 件）。
  - はみ出したのは内閣名だけ（不合格理由 2）。

### デザイン評価（基準 7/10）
- **デザインの質: 7/10**
  - 黒ヘッダー → 青い帯 → キャンバスの構成が一貫している。
  - 1024px の管理者の表は、役職・氏名・在任・出典・操作の列が揃い、在任は日付が 2 つあれば「…から」「…まで」の 2 行（`t3-cab11-admin-light-1024.png`）。
- **オリジナリティ: 7/10**
  - Sprint 1〜3 と同じ個性（青い帯、在任中の内閣を青い行で強調、細い罫線の表、丸い枠のボタン）。
  - AI スロップの兆候は 3 つ未満。
- **クラフト: 6/10 — 基準未達**
  - 良くなった点: 役職名・氏名の折れは全幅で 0 件。管理者のカードの並び、44px、Tab 順も揃っている。
  - 減点 1: 未ログインと一般ユーザーの 768〜799px で、在任「…ま／で」「…か／ら」が 1 文字だけ落ちる。日付が 2 つある行は正しく 2 行に分かれるので、同じ表の中で不揃いに見える（`t3-cab11-anon-light-768.png`）。
  - 減点 2: 登録した内閣名が折れずに、h1 が画面の外で切れる・隣の列に重なる。
  - 減点 3: 管理者のカードで、出典の位置が行によって変わる。
- **機能性: 7/10**
  - キーボードで全操作ができる。ダイアログは modal で、Esc で閉じる。
  - 減点（見送り済みのもの）: 人物欄で ↓ / Enter が候補に効かない。操作のあとフォーカスが `body` に落ちる。

### 再テスト対象（次回、最初に確認する項目）
1. 未ログインと一般ユーザー、768 / 780 / 799 / 800 / 1024px、ライトとダークで、`/cabinets/1`〜`9` と在任の 4 パターンがある内閣を開き、在任の各行が `^(\d{4}年\d{1,2}月\d{1,2}日(から|まで))+$` に合うこと（今回は 18 件が不合格）。
2. 管理者でも同じ確認をする（今回は 0 件。保たれていること）。
3. 9 文字と 24 文字の内閣名で、375 / 768 / 1024 / 1280px の `/`、`/cabinets/N` の h1、`/persons/N` の所属の列で、はみ出し 0 件、h1 が切れないこと。
4. 管理者のカード（768 / 1023 / 375px）で、在任が空の行も含めて、出典の位置が揃っていること。
5. 今回合格した、全幅の役職名・氏名の折れ 0 件、在任のはみ出し・重なり 0 件、横スクロールなしが保たれていること。

### 改善提案・見送り済みの項目（FAIL の理由ではない）
- 人物欄の ↓ / Enter の操作。
- 操作のあとのフォーカスの戻し先。
- 削除ダイアログの初期フォーカスを「キャンセル」に。
- 発足日 `0000-01-01` が通る。
- ルートの not-found を日本語に。
- `warning-ink` を DESIGN.md に反映する（ユーザーの承認が必要）。

### メインセッションへの連絡（後片付け）
- **`apps/web/next-env.d.ts`:**
  - 私の `pnpm build` が `.next/types` 版に書き換え、その状態のまま評価中にコミット `d2c00fb` が作られました。
  - そのあとコミット `e9c3f8e` で dev 版（`.next/dev/types/...`）に戻されています。
  - 評価の終了時点で、作業ツリーはクリーン、`next-env.d.ts` は dev 版です。私はファイルを書き換えていません。
- **使い捨て DB:** `eval-s4-t3.db`（scratchpad）
  - アカウント: `t3admin@`（管理者）、`t3user@`、`t3ui@eval.example.test`。
  - 内閣: 10「評価T3内閣」、11「評価T3長日付内閣改」（在任の 4 パターン）、12「評価T3とても長い内閣名の表示確認用テスト内閣」、13「評価T3API内閣」（API の確認で作成）。
  - 人物: 178「評価T3新人」、179「評価T3長い氏名テスト用の長い名前です右衛門之助」。
  - Cookie ファイル: `ck-t3admin-t3.txt`、`ck-t3user-t3.txt`（同じ scratchpad 内）。
- **サーバー:** 3100 は停止済み（応答なしを確認）。3000 の開発サーバーは動いたまま（200）。
- **その他のファイル:** 走査に使ったスクリプトは scratchpad の `t3/scan.mjs`、スクリーンショットは `t3-*.png`。リポジトリには何も保存していません。Playwright MCP のブラウザは使っていません（Node の Playwright を使用）。

VERDICT: FAIL
RETURN_TO: designer

---

## 試行 4

VERDICT: FAIL
RETURN_TO: designer

## Evaluator 判定: 不合格 (Sprint 4 / 試行 4)

試行 3 で指摘した 3 点は直っていました。契約 15 項目、権限、入力検証、Sprint 1〜3 の回帰もすべて合格です。

ただし、今回の内閣名の修正（`cabinet-name.tsx` に `[overflow-wrap:anywhere]` を追加）で、新しい回帰が出ました。初期データの内閣名が、人物ページで「…内／閣」と 1 文字だけ折れます。前回直した「ま／で」と同じ種類の問題なので、クラフトは 6/10 で基準（7）に届きません。

同じ種類の問題（内閣名の折れ・はみ出し）は、下にまとめてあります。

### 不合格理由（重大な順）

**1. 回帰: 人物ページの「所属」の列で、初期データの内閣名が「内／閣」と折れる（768〜約 795px）**

- 再現手順:
  - 未ログイン・ライトで、幅 768px で `/persons/23`（林芳正）を開く。
  - 所属の列に「第2次高市内／閣」「第1次石破内／閣」「第2次岸田／第2次改造内／閣」などと出る。
  - 証拠: `t4-person23-768-light.png`
- 件数（88 人の人物ページすべてを機械的に走査）:

| 幅 | 折れた件数 |
|---|---|
| 768px | 136 件 |
| 780px | 136 件 |
| 790px | 136 件 |
| 799 / 800px | 0 件 |

- 対象は 67 ページです。折れた名前は「第2次高市内閣」「第1次高市内閣」「第2次石破内閣」「第1次石破内閣」「第2次岸田内閣」「第1次岸田内閣」「第2次岸田第2次改造内閣」の 7 つです。
- 375 / 800 / 850 / 900 / 1024 / 1280px では 0 件です。`/` と `/cabinets/N` の h1 も、360〜1440px を 8px 刻みで調べて 0 件でした。
- 原因（ブラウザ上で `overflow-wrap` を `normal` に戻すと、どれも 1 行に戻ることを確認済み）:
  - `/persons/N` の表は `table-fixed` です。768〜790px では、所属の列（`w-[20%]`）の中身の幅が 102〜105px しかありません。
  - 「第2次石破内閣」には約 107px 必要です。
  - 試行 3 までは、文字が右の余白に 2〜5px はみ出すだけで、見た目は 1 行でした。
  - `anywhere` を足したことで、「内」と「閣」の間でも折れるようになりました。
- 修正指示（戻し先: designer）: `apps/web/src/app/persons/[id]/page.tsx` の所属の `<td>`（`[word-break:keep-all]` が付いているもの）に `md:max-lg:text-sm` を足してください。
  - 同じ行の就任日・退任日のセルは、すでに `md:max-lg:text-sm` を使っています。
  - ブラウザ上でこのスタイルを当てて試したところ、768〜1023px（8px 刻み）と 1024 / 1088…1280px で、名前の折れは 0 件になりました。
  - 別案として、列幅を「所属 22% / 出典 23%」に変えても折れは 0 件でした。
  - `cabinet-name.tsx` の `anywhere` は残してください。外すと、長い内閣名が `/` と人物ページでまたはみ出します（`break-word` に変えるだけの案もブラウザ上で試しましたが、39 件はみ出しました）。

**2. 同じ種類: 空白のない英字だけの長い内閣名が、閣僚フォームと検索候補ではみ出して切れる**

- 管理者が画面から「ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWX」（50 文字）の内閣を登録すると起きます。
- 閣僚の追加・編集フォーム（`/cabinets/15/appointments/new`、`/cabinets/15/appointments/188/edit`）、375px:
  - 「対象の内閣:」の名前の右端が 559px まで伸び、375px より右が見えなくなります。段落の右端は 351px です。
  - 証拠: `t4-form-cab15-new-375.png`
- ヘッダーの検索候補（「ABCDEFGHIJ」で検索）:
  - 375px: 候補の右端 350px に対し、名前の右端が 576px で切れます。
  - 1280px: 候補の右端 1231px に対し、名前の右端が 1400px まで伸びます。
  - 証拠: `t4-search-latin-375.png`
- 日本語の 9 / 24 / 50 文字の名前は、フォームと検索候補のどちらでも 0 件で、問題はありません。
- 修正指示（戻し先: designer）:
  - フォーム: `apps/web/src/app/cabinets/[id]/appointments/new/page.tsx` の 29 行目付近と、`.../[appointmentId]/edit/page.tsx` の 34 行目付近にある `<p className="mt-4 text-body">` に `[overflow-wrap:anywhere]` を足す（または名前を `CabinetName` で表示する）。
  - 検索候補: `apps/web/src/components/search-box.tsx` の候補の文字の要素に `[overflow-wrap:anywhere]` と `min-w-0` を足す。
- 現実の内閣名ではまず起きない入力ですが、試行 3 の「長い名前のはみ出し」と同じ種類なので、ここで一緒に直してください。

### 前回（試行 3）の不合格項目の再テスト: 3 点とも合格

**評価環境**
- 本番ビルドをポート 3100 で起動し、使い捨て DB `eval-s4-t4.db`（scratchpad）を使った。
- 走査は Node の Playwright で行った。各文字の位置から行を組み立てて数えた。

**走査が問題を検出できることの確認**
- 1 日付だけの在任の `whitespace-nowrap` を外すと、768 / 780px で各 16 件の「ま／で」を検出した。
- 管理者の出典の `max-lg:w-full` を外すと、「出典の横位置が行で違う」を検出した。
- 内閣名の `keep-all` を外すと、「第2次岸田第2次改造／内閣」を検出した。

**走査の範囲**
- 組み合わせ: 未ログイン・一般ユーザー・管理者 × ライト・ダーク
- 幅: 375 / 768 / 780 / 799 / 800 / 1023 / 1024 / 1280px
- 内閣: `/cabinets/1`〜`15`
  - 9 件は初期データ。
  - 10 は評価T4内閣改、11 は在任の 4 パターン、12〜15 は長い名前（9 / 24 / 50 文字、英字 50 文字）。
- 各組み合わせで 1,496 行を確認した。

**結果**
- 指摘 1（1 日付だけの在任の折れ）: 在任の行が正規表現 `^(\d{4}年\d{1,2}月\d{1,2}日(から|まで))+$` に合わない件数は、6 つの組み合わせすべてで 0 件。
  - 証拠: `t4-cab11-anon-dark-780.png`
- 指摘 2（長い内閣名のはみ出し）: 9 / 24 / 50 文字の名前は、`/` と h1 で、375 / 768 / 1024 / 1280px とも折れて収まった。他の列との重なりも、画面の外での切れもない。
  - 証拠: `t4-list-table-light-768.png`、`t4-cab14-h1-light-375.png`、`t4-person178-light-768.png`
  - ただし、人物ページで初期データの名前が折れる（不合格理由 1）。
- 指摘 3（管理者のカードの出典の位置）: 375〜1023px のカードで、出典の横位置はすべての行で 0px。在任が空の行も同じ位置で、出典が氏名と同じ行に出る件数も 0 件。
  - 証拠: `t4-cab11-admin-light-768.png`（防衛大臣 石破茂の行）
- 管理者のカード: 編集・削除が 1 行に並び、44px 以上。「出典なし」は折れない。見た目の順と Tab 順は一致（Tab 順は 氏名 → 出典 → 編集 → 削除）。
- 1023px はカード（`block`）、1024px は表（`table`）で、切り替わりの崩れはない。
- 試行 2・3 の状態は保たれている: 役職名・氏名の折れ、在任・出典・操作のはみ出しと重なり、横スクロールは、いずれも 0 件。

### スプリント契約（すべて合格。画面から操作した）

- [x] **1. 管理者用のボタンが出ない** — 未ログインと一般ユーザーで、`/` と `/cabinets/6`・`/cabinets/9` の「内閣を追加」「内閣を編集」「閣僚を追加」「編集」「削除」と「操作」の列は 0 件。管理者では 1 / 1 / 1 / 19 / 19 / 1 件。
- [x] **2. 発足日順の位置** — 評価T4内閣（2023-01-01）が、第2次岸田第2次改造内閣と第2次岸田改造内閣の間に出た。
- [x] **3. 閣僚のいない内閣** — `/cabinets/10` に「登録された閣僚はいません」と出た。
- [x] **4. 内閣名が空** — 「内閣名は必須です」と出て、一覧は 9 件のまま。
- [x] **5. 終了日が発足日より前** — 2027-04-01 / 2027-03-31 で「終了日は発足日以降の日付にしてください」と出て、追加されない。
- [x] **6. 既存の人物で閣僚を追加** — 「芳正」で候補の林芳正を選び、就任日 2023-02-01 で保存。名簿に「内閣官房長官 林芳正 2023年2月1日から」の行が出た。
- [x] **7. 新しい人物の登録** — 「評価T4新人」で「どの人物にも一致しません」と「新しい人物として登録」が出た。登録すると選択中の人物が評価T4新人になった（`/persons/178`）。
- [x] **8. 出典 URL と出典メモ** — 出典リンクは `href=https://example.com/source`、`_blank`、`noopener noreferrer`。`/persons/23` の経歴の行に「テスト出典」が出た。
- [x] **9. 出典 URL「abc」** — 指定の文言が出て、フォーカスが `#sourceUrl` に移った。名簿は 2 行のまま。
- [x] **10. 就任日 2022-12-31** — 「就任日は内閣の在任期間内にしてください」と出て、行は増えない。
- [x] **11. 2 人目の内閣官房長官** — 「同じ期間にこの役職の在任者がいます」（409）と出て、行は増えない。
- [x] **12. 行の編集**
  - フォームには既存の値が入っていた。
  - 退任日を 2024-06-30、メモを「テスト出典（修正後T4）」にして保存した。
  - 名簿には「2023年2月1日から2024年6月30日まで」。人物ページの行にも両方が出た。
- [x] **13. 行の削除**
  - ダイアログは modal。本文は「外務大臣の加藤勝信の人事を削除します。…」。
  - Esc で閉じ、行は残る。
  - 「削除する」で 3 行から 2 行になった（再読み込み後も 2 行）。`/persons/2` の評価T4内閣の行は 1 件から 0 件になった。
- [x] **14. 再起動後も残る**
  - 3100 を止め（応答 000 を確認）、もう一度起動した。
  - 内閣の修正（評価T4内閣改、終了日 2027-03-31）、人事、出典 URL、修正後のメモが、`/`、`/cabinets/10`、`/persons/23` に残っていた。
  - 確認したのは開発サーバーではなく本番サーバーです（3000 は停止しない指示のため）。
- [x] **15. 回帰: 経歴のある人物の削除** — 林芳正の「削除」→「削除する」で「経歴が登録されている人物は削除できません」と出て、再読み込み後も h1 は林芳正。

### 権限・入力検証（合格）

**書き込み API**（POST 内閣、PUT 内閣、POST 人事、PUT 人事、DELETE 人事）

| 呼び出し元 | 結果 |
|---|---|
| 未ログイン | すべて 401 |
| 一般ユーザー | すべて 403 |
| 管理者 + Origin `https://evil.example.test` | すべて 403 |
| 管理者 + 別の内閣の人事 ID で削除 | 404 |

**入力の拒否**（すべて 400）

| 入力 | 結果 |
|---|---|
| 出典 URL `abc`、`javascript:alert(1)` | `sourceUrlInvalid` |
| 2023-02-30 | `startDateInvalid` |
| 存在しない人物 | `personNotFound` |
| 一覧にない役職 | `postInvalid` |
| 内閣名 `<script>` | `nameInvalidChar` |
| 内閣名 51 文字 | `nameTooLong` |

**直接 URL**（`/cabinets/new`、`/cabinets/10/edit`、`…/appointments/new`、`…/appointments/179/edit`）
- 未ログインは 307 で `/login` へ。
- 一般ユーザーには「この操作は管理者だけができます」が出る。

### 回帰確認

不合格理由 1 は、Sprint 2 の人物ページの見た目の回帰です。機能の回帰はありません。

- **Sprint 1:** `/cabinets/99999` は 404 で「内閣が見つかりません」。
- **Sprint 2:**
  - `/persons/99999` は 404 で「人物が見つかりません」。
  - 「いしば」→ ↓ + Enter で `/persons/103`（石破茂）に移る。
  - `/cabinets/7` に加藤勝信が出る。
- **Sprint 3:**
  - 画面から登録した `t4ui@eval.example.test` は一般ユーザーになる（ヘッダーに「人物を追加」が出ない）。
  - `/persons/new` で権限エラーが出る。
  - 一般ユーザーには人物の削除ボタンが出ない。
- **管理者付与コマンド:** 成功は終了コード 0 と「…を管理者にしました」。未登録のメールアドレスは「該当するアカウントがありません」で終了コード 2。
- **検証コマンド:** `pnpm lint`、`pnpm typecheck`、`pnpm test`（db 62 件、web 19 件）、`pnpm build` はすべて成功。

### エッジケース・健全性
- **コンソール:** 出たのは、想定どおりの 400 / 409（入力の拒否と重なり）と、存在しない ID の 404 だけ。5xx なし。
- **ログインの連続実行:** 走査を 6 つ同時に走らせたとき、ログインに 429 が 1 回返った。ログインの回数制限が働いたもので、時間を置けば通った。
- **シークレット:** 画面にも応答にも出ていない。
- **横スクロール:** なし（`html` と `body` は `overflow-x: clip`）。
- **影:** box-shadow は 0 件。
- **ヘッダーの高さ:** 375 / 768 / 1023 / 1024 / 1280px で 165 / 109 / 109 / 109 / 61px（4 つの組み合わせとも）。
- **フォーカス枠:** 2px solid、outline-offset 3px。ライトは #0064b7、ダークは #53b1ff。
  - 編集・削除・内閣を編集はフォーカス中も丸い形。
- **在任の文字の色:** ライトは #6b6b6b（白地に対し 5.33:1）、ダークは rgba(229,229,229,.55)（黒地）。
- **補足（不合格の理由ではない）:** `/persons/23` の 840〜856px（とブラウザ上で試した別案の幅）で、出典メモ「テスト出典（修正後T4）」の最後の文字が、段落の右端を 2〜6px 越える。セルの右の余白の中に収まっていて、他の列とは重ならない。今回の変更とは関係なく、前からある状態。

### デザイン評価（基準 7/10）
- **デザインの質: 7/10**
  - 黒ヘッダー → 青い帯 → キャンバスの構成が一貫している。
  - 長い内閣名も、h1 で軽いウェイトのまま段組みが崩れない（`t4-cab14-h1-light-375.png`）。
- **オリジナリティ: 7/10**
  - 青い帯、在任中の内閣を青い行で強調、細い罫線の表、丸い枠のボタン。
  - AI スロップの兆候は 3 つ未満。
- **クラフト: 6/10 — 基準未達**
  - 良くなった点: 在任の折れ、管理者のカードの出典の位置、長い内閣名のはみ出しは解消し、走査では 0 件。
  - 減点 1: 人物ページの 768〜約 795px で、初期データの内閣名がほぼすべて「内／閣」と 1 文字だけ落ちる（`t4-person23-768-light.png`）。前回直した「ま／で」と同じ種類の崩れが、今回の修正で別の画面に出た。
  - 減点 2: 英字の長い名前が、フォームと検索候補で切れる。
- **機能性: 7/10**
  - キーボードで全操作ができ、Tab 順と見た目の順が一致する。ダイアログは modal で、Esc で閉じる。
  - 減点（見送り済みのもの）: 人物欄の ↓ / Enter、操作のあとのフォーカス位置。

### 再テスト対象（次回、最初に確認する項目）
1. 未ログイン・ライトとダーク、幅 768〜1023px（8px 刻み）で、人物ページ 88 件すべての所属の列で、初期データの内閣名が「第N次」「改造」の区切り以外で折れないこと（今回は 768 / 780 / 790px で各 136 件）。
2. 同じ範囲で、9 / 24 / 50 文字と英字 50 文字の内閣名が所属のセルに収まること（`/persons/178`）。
3. `/cabinets/15/appointments/new` と `/cabinets/15/appointments/188/edit`（375px）、ヘッダーの検索候補（「ABCDEFGHIJ」で検索、375 / 1280px）で、名前が枠の中で折れること。
4. 今回 0 件だった項目が保たれていること: 在任の正規表現、管理者のカードの出典の位置、`/` と h1 の内閣名、役職名・氏名の折れ、横スクロールなし。

### 改善提案・見送り済みの項目（FAIL の理由ではない）
- 人物欄の ↓ / Enter の操作。
- 操作のあとのフォーカスの戻し先。
- 削除ダイアログの初期フォーカス。
- 発足日 `0000-01-01` が通る。
- ルートの not-found を日本語に。
- `warning-ink` を DESIGN.md に反映する（ユーザーの承認待ち）。
- 人物ページの出典メモの末尾が 2〜6px はみ出す（上記の補足）。

### メインセッションへの連絡（後片付け）
- **`apps/web/next-env.d.ts`:** 私の `pnpm build` が書き換え、変更されたままです（`git status` で ` M`、2 行の差分）。メインセッションで戻してください。ほかにリポジトリ内のファイルは変更・作成していません。
- **サーバー:** 3100 は停止済み（応答 000 を確認）。3000 の開発サーバーは動いたまま（200）。
- **`local.db`:** 読み取りだけで、書き込みはしていない。3000 の `/api/cabinets` は 9 件のまま。
- **使い捨て DB:** `eval-s4-t4.db`（scratchpad）。アカウント: `t4admin@`（管理者）、`t4user@`、`t4ui@eval.example.test`。内閣: 10 評価T4内閣改、11 評価T4在任4型内閣、12 評価長名九文字内閣、13 第2次評価長名テスト内閣表示確認用第3次改造内閣、14 50 文字の日本語の名前、15 英字 50 文字の名前。人物: 178「評価T4新人」。
- **スクリプトとログ・スクリーンショット:** scratchpad の `t4/`（`scan4.mjs`、`scanfn.mjs`、`pcount.mjs`）と `t4-*.png`。

VERDICT: FAIL
RETURN_TO: designer

---

## 試行 5

VERDICT: FAIL
RETURN_TO: designer

## Evaluator 判定: 不合格 (Sprint 4 / 試行 5)

試行 4 で指摘した 2 点は直っていました。契約 15 項目、権限、入力検証、Sprint 1〜3 の回帰もすべて合格です。

ただし、今回新しく調べた「空白のない英字だけの長い氏名（50 文字。Sprint 3 から登録できる値）」が、閣僚名簿と内閣一覧の表のセルからはみ出し、隣の列の文字に重なります。試行 4 の不合格理由 2（英字の長い内閣名のはみ出し）と同じ種類です。このためクラフトは 6/10 で、基準の 7 に届きません。指示に従い、同じ種類の問題は下にまとめてあります。

### 不合格理由（重大な順）

**1. 英字だけの 50 文字の氏名が、閣僚名簿と内閣一覧のセルからはみ出して隣の列に重なる（どの役割・ライト/ダークでも起きる）**
- 再現手順:
  1. 管理者で `/persons/new` を開き、氏名 `EvalTfiveLongPersonNameWithoutAnySpacesForTestingX`（50 文字）を登録する。
  2. ある内閣に、この人物の閣僚人事を追加する（今回は内閣 15 に財務大臣、内閣 13 に内閣総理大臣として追加）。
  3. 未ログインで `/cabinets/15` を開く。
- 閣僚名簿（`/cabinets/13`、`/cabinets/15`）:
  - 1024〜1440px（全役割）と 768〜1023px（未ログイン・一般ユーザー）: 氏名の文字が在任と出典の列に重なり、「2019年10月5日から」と「出典なし」が読めなくなる。証拠: `t5-roster-longlatin-anon-1280.png`、`t5-dialog-long-light-1280.png`（ダイアログの奥の行）
  - 768 / 800px: 文字の右端がそれぞれ 778 / 810px で、画面の外で切れる。
  - 375px（全役割）: 文字の右端が 376px で、画面の外で切れる（`t5-roster-longlatin-anon-375.png`。「…WithoutAn」で切れている）。
  - 件数: 14 幅（375〜1440px）を走査。未ログインと一般ユーザーは、ライト・ダークとも 1 内閣あたり 32 件。管理者は 1 内閣あたり 9 件（768〜1023px はカード表示のため、375px と 1024px 以上だけで起きる）。
- 内閣一覧 `/` の総理大臣の列（この人物が内閣総理大臣の内閣）:
  - 全幅で、文字がセルの右端を越えて発足日の列に重なる。
  - 越える量: 375px で 4px、768px で 6px、1023px で 14px、1280px で 10px、1440px で 10px。
  - 証拠: `t5-list-longlatin-pm-1280.png`（「2019年4月1日」の上に氏名が重なる）
- 期待: 試行 4 の内閣名や、今回の検索候補・人物欄・ダイアログと同じように、枠の中で折り返す。
- 問題がない箇所: 同じ氏名でも、人物欄の候補、選択中の人物、ヘッダーの検索候補、削除ダイアログ（375 / 768 / 1280px、ライト/ダーク）は 0 件で、枠の中で折れている。50 文字の日本語の氏名（`/persons/180`）は、名簿・一覧ともセルの中で折れていて問題ない。
- 原因:
  - `apps/web/src/app/cabinets/[id]/page.tsx` の 209〜215 行目付近: 氏名のセルの `<Link className="link-inline inline-flex min-h-11 items-center">` に折り返しの指定がない。`inline-flex` なので、中の文字は最小幅より狭く縮まない。
  - `apps/web/src/app/page.tsx` の 97〜102 行目: 総理大臣の `<td>` にも折り返しの指定がない。
- 修正指示（戻し先: designer）:
  - 名簿: 氏名を `<span className="min-w-0 [overflow-wrap:anywhere]">` で包み、Link に `max-w-full` を足す。
  - 一覧: 総理大臣の `<td>` に `[overflow-wrap:anywhere]` を足す。
  - **注意（試行 4 と同じ失敗をしないこと）**: `anywhere` は、表の列幅の計算に使う最小幅を小さくする。これで普通の氏名（「林芳正」「加藤勝信」）が途中で折れないか、全幅で確かめる。そうなる場合は、`anywhere` を長い名前のときだけ効かせる方法（例: `break-words` と `min-w-0` の組み合わせ）に変える。
  - 確かめ方: `scanfn.mjs` の `name wrap` / `name overflow` / `char overflow` が、通常データで 0 件、長い氏名でも 0 件になること。

**2. 同じ種類（前からある。Sprint 2 から。今回の変更による回帰ではない）: 人物ページの役職の列で、役職名が語の途中で折れ、1 文字だけ次の行に落ちる**
- 人物ページ 90 件（通常データの 88 件と、今回作った 179・180）を未ログイン・ライトで走査し、役職のセルが 2 行以上になった件数を数えた。

| 幅 | 件数 |
|---|---|
| 768 / 800 / 840 / 880 / 904px | 各 115 件 |
| 944〜1024px | 各 35 件 |
| 1100px | 35 件 |
| 1180 / 1280 / 1440px | 各 26 件 |

- 対象のページは 59 件。375px は 0 件。
- 1 文字だけ落ちる例と件数: 「内閣総理大／臣」33、「内閣官房長／官」33、「経済産業大／臣」33、「農林水産大／臣」33、「厚生労働大／臣」27、「文部科学大／臣」27、「国土交通大／臣」27、「デジタル大／臣」27、「少子化対策担当大／臣」24、「行政改革担当大／臣」1。
- 証拠: `t5-person23-memo-904.png`（「内閣官房長／官」「経済産業大／臣」）、`t5-d-anon-light-768_persons_23.png`
- 原因: `apps/web/src/app/persons/[id]/page.tsx` の役職の列が `w-[15%]` で、`text-lg`（18px）。768px では、6 文字の役職名に必要な約 108px に対して、101px しかない。
- 修正指示（戻し先: designer）。次のどれか、または組み合わせ:
  - 役職の `<td>` に `md:max-lg:text-base` と `[text-wrap:pretty]` を足す（`pretty` は最後の行が 1 文字になるのを避ける）。
  - 役職の列を 15%→18% 前後に広げ、他の列で調整する。
  - 所属の列（試行 4 の修正点）を再び狭めないこと。人物ページの所属の列の走査（下の「試行 4 の不合格項目の再テスト」の 1）で、0 件が保たれることを必ず確認する。
- 前からある状態ですが、「内／閣」（試行 4 の不合格理由 1）と同じ見え方の崩れなので、ここで一緒に直すことを勧めます。

### 前回（試行 4）の不合格項目の再テスト: 合格

**評価環境**
- 本番ビルドをポート 3100 で起動し、使い捨て DB `eval-s4-t5.db` を使った。
- 走査は Node の Playwright で行った。各文字の位置から行を組み立てて数えた。

**走査が問題を検出できることの確認**
- `/persons/23` の 768px で、所属の列の文字サイズを 16px に、列幅を 20% / 25% にブラウザ上で戻した。
- 「第2次高市内／閣」などを 14 件検出した（修正後の状態では 0 件）。

**1. 人物ページの所属の列: 合格**
- 範囲: 88 ページ × 37 幅 × ライト/ダーク（未ログイン）で、5,256 回の確認。
  - 幅は 768〜1023px（8px 刻み）と 375 / 1024 / 1280 / 1440px。
- 初期データの内閣名の折れ: 0 件。
- `anywhere` で行の折れ方が変わった件数: 0 件。
- 人物名の h1 が `anywhere` で変わった件数: 0 件。h1 が 2 行になった人物: 0 人。
- 9 / 24 / 50 文字と英字 50 文字の内閣名（`/persons/178`）: セルの中に収まり、はみ出しは 0 件。

**2. フォーム・検索候補・人物欄・削除ダイアログ: 合格**
- 範囲: 375 / 768 / 1280px、ライト/ダーク。
- `/cabinets/11`〜`15/appointments/new` と編集フォームで、英字 50 文字の内閣名は 2 行に折れて収まる（`t5-selected-long-375.png`）。
- 「ABCDEFGHIJ」の検索候補もはみ出しは 0 件。
- 英字 50 文字の氏名の、人物欄の候補、選択中の人物、削除ダイアログ（1280px を含む）も 0 件。
- 補足: 機械判定では「選択中の人物」が引っかかったが、誤検出だった。原因は sr-only の「選択中の人物:」の文字の範囲（幅 1px で切り取られている）で、見えている氏名の右端は段落の右端と同じ（119.19 / 119.19px）。

**3. `anywhere` が普通の名前を折っていないか: 合格**
- 範囲: `/`、`/cabinets/1`〜`15` × 未ログイン・一般ユーザー・管理者 × ライト/ダーク × 14 幅（375〜1440px）。
- 初期データの内閣名の途中の折れ: 0 件。`anywhere` による変化: 0 件。役職名と氏名の折れ: 0 件。ただし、今回作った長い氏名の行は不合格理由 1 を参照。
- 検索候補: 520 個を、5 幅 × ライト/ダーク × 10 語で確認した。`anywhere` で折れ方が変わったのは英字 50 文字の内閣名の 6 件だけで、これは期待どおり。はみ出しは 0 件。

**4. 前回 0 件だった項目: 保たれている**
- 在任の正規表現に合わない件数: 未ログイン・一般ユーザー・管理者 × ライト/ダークのすべてで 0 件。
- 管理者のカード: 出典の横位置の差は 0 件。1023px はカード（`block`）、1024px は表（`table`）。
- 横スクロール: 0 件。

**6. 出典メモ: 不合格の理由ではない**
- `/persons/23` の 904〜928px で、「テスト出典（修正後T5）」が段落の右端を 0.6〜6.1px 越える。984 / 1232px の初期データのメモも 1.0〜1.2px 越える。
- どれもセルの右端（余白）の内側で、最後の列なので他の列とは重ならない。
- 175 文字の日本語のメモと、138 文字の英字のメモ（空白なし）は、2 行で省略表示され、はみ出しは 0 件。

### スプリント契約（15 項目すべて合格。画面から操作した）
- [x] 1 — 未ログインと一般ユーザー: 管理者用のボタンはすべて 0 件。管理者: 内閣を追加 1、内閣を編集 1、閣僚を追加 1、編集 19、削除 19、操作の列 1。
- [x] 2 — 評価T5内閣（2023-01-01）が、第2次岸田第2次改造内閣と第2次岸田改造内閣の間に出た。
- [x] 3 — 「登録された閣僚はいません」と出た。
- [x] 4 — 「内閣名は必須です」と出て、一覧は 9 件のまま。
- [x] 5 — 「終了日は発足日以降の日付にしてください」と出て、追加されない。
- [x] 6 — 「芳正」で林芳正を選んで保存。名簿に「内閣官房長官 林芳正 2023年2月1日から」の行が出た。
- [x] 7 — 「どの人物にも一致しません」と「新しい人物として登録」が出た。登録すると選択中が評価T5新人になった（`/persons/178`）。
- [x] 8 — 出典リンクは `href=https://example.com/source`、`_blank`、`noopener noreferrer`。`/persons/23` の経歴の行に「テスト出典」が出た。
- [x] 9 — 指定の文言が出て、フォーカスが `#sourceUrl` に移った。名簿は 2 行のまま。
- [x] 10 — 「就任日は内閣の在任期間内にしてください」と出て、行は増えない。
- [x] 11 — 「同じ期間にこの役職の在任者がいます」と出て、行は増えない。
- [x] 12 — 名簿は「2023年2月1日から2024年6月30日まで」。人物ページの行にも「テスト出典（修正後T5）」が出た。
- [x] 13 — ダイアログは modal。Esc で閉じ、行は残る。「削除する」で 3 行から 2 行になった（再読み込み後も同じ）。`/persons/2` の経歴の行は 1 件から 0 件になった。
- [x] 14 — 3100 を止め（応答 000）、もう一度起動した。評価T5内閣改、人事、出典 URL、修正後のメモが、`/`、`/cabinets/10`、`/persons/23` に残っていた。確認したのは本番サーバー（3000 は停止しない指示のため）。
- [x] 15 — 「経歴が登録されている人物は削除できません」と出て、再読み込み後も h1 は林芳正。

### 権限・入力検証（合格）
- 書き込み API（POST 内閣、PUT 内閣、POST 人事、PUT 人事、DELETE 人事）:
  - 未ログイン: すべて 401
  - 一般ユーザー: すべて 403
  - 管理者 + Origin `https://evil.example.test`: すべて 403
  - 別の内閣の人事 ID で削除: 404
- 入力の拒否（すべて 400）:
  - `abc` と `javascript:alert(1)`: `sourceUrlInvalid`
  - 2023-02-30: `startDateInvalid`
  - 存在しない人物: `personNotFound`
  - 一覧にない役職: `postInvalid`
  - 内閣名 `<script>`: `nameInvalidChar`
  - 内閣名 51 文字: `nameTooLong`
- 直接 URL（4 種類）: 未ログインは 307 で `/login` へ。一般ユーザーには「この操作は管理者だけができます」が出る。

### 回帰確認（合格）
- Sprint 1: `/cabinets/99999` は 404 で「内閣が見つかりません」。
- Sprint 2:
  - `/persons/99999` は 404 で「人物が見つかりません」。
  - 「いしば」→ ↓ + Enter で `/persons/103`（石破茂）に移る。
  - `/cabinets/7` に加藤勝信が出る。
- Sprint 3:
  - 画面から登録した `t5ui@eval.example.test` は一般ユーザーになる（「人物を追加」0 件、`/persons/new` は権限エラー、削除ボタン 0 件）。
  - `admin:grant` は、成功で終了コード 0、未登録で 2、引数なしで 1。
- 減点された観点:
  - ヘッダーの高さ: 375 / 768 / 1024 / 1280px で 165 / 109 / 109 / 61px（4 つの組み合わせとも）。
  - box-shadow: 0 件。
  - フォーカス枠: 2px solid、outline-offset 3px。ライトは #0064b7、ダークは #53b1ff。ボタンはフォーカス中も丸い形。
  - 在任の文字: ライトは #6b6b6b で白地に 5.33:1。ダークは rgba(229,229,229,.55) で、黒地での実効色は約 #7e7e7e、約 5.2:1。
- 検証コマンド: `pnpm lint`、`pnpm typecheck`、`pnpm test`（db 62 件、web 19 件）、`pnpm build` はすべて成功。

### エッジケース・健全性
- コンソール: 出たのは、想定どおりの 400 / 409 と、走査の同時ログインによる 429 が 1 回（ログインの回数制限。再実行で通った）だけ。5xx なし。
- シークレット: 画面にも応答にも出ていない。

### デザイン評価（基準 7/10）
- デザインの質: 7/10。黒ヘッダー → 青い帯 → キャンバスの構成が一貫している。長い内閣名も、h1 で軽いウェイトのまま折れて収まる。
- オリジナリティ: 7/10。青い帯、細い罫線の表、丸い枠のボタン。AI スロップの兆候は 3 つ未満。
- クラフト: 6/10 — **基準未達**
  - 減点 1: 英字の長い氏名が、名簿で在任と出典の列の文字に重なり、一覧でも発足日の列に重なる（`t5-roster-longlatin-anon-1280.png`）。
  - 減点 2: 人物ページの役職名が「内閣総理大／臣」と 1 文字だけ落ちる。
  - 良くなった点: 試行 4 の 2 点は解消した。
- 機能性: 7/10。キーボードで全操作ができる。見送り済みの人物欄の ↓ / Enter と、操作のあとのフォーカス位置は減点に含めた。

### 再テスト対象（次回、最初に確認する項目）
1. `/cabinets/13`・`/cabinets/15`（英字 50 文字の氏名の行）と、`/` の総理大臣の列。3 役割 × ライト/ダーク × 375〜1440px で、はみ出しと重なりが 0 件になること。普通の氏名が折れないこと（`/cabinets/1`〜`9`、全幅）。
2. 人物ページの役職の列で、1 文字だけ落ちる折れが 0 件になること（768〜1440px）。
3. 今回合格の項目が保たれていること: 人物ページの所属の列（88 ページ × 37 幅 × ライト/ダーク）、フォーム、検索候補、ダイアログ、在任の正規表現。

### 改善提案・見送り済みの項目（FAIL の理由ではない）
- テストで作った内閣名「評価T5在任4型内閣」（10 文字）が、人物ページの 768px で「…内／閣」と折れる。セルの中には収まっている。役職の列を広げるなら、所属の列との配分も合わせて見直してほしい。
- 次の項目は見送り済みのまま: 人物欄の ↓ / Enter、操作のあとのフォーカス、ダイアログの初期フォーカス、`0000-01-01`、ルートの not-found、`warning-ink`、出典メモの 0.6〜6px の越え。

### メインセッションへの連絡（後片付け）
- `apps/web/next-env.d.ts`: 私の `pnpm build` が書き換えた。評価の途中でコミット a95469f が入り、最後の `git status` ではきれいな状態（差分なし）だった。私はリポジトリ内のファイルを変更・作成していない。今回評価したコードは、このコミットの 7 ファイルと同じ差分です。
- サーバー: 3100 は停止済み（応答 000）。3000 は動いたまま（200）。
- `local.db`: 読み取りだけ。3000 の内閣は 9 件のまま。
- 使い捨て DB: `eval-s4-t5.db`（scratchpad）。アカウント: `t5admin@eval.example.test`（管理者）、`t5user@`、`t5ui@`。内閣: 10「評価T5内閣改」、11「評価T5在任4型内閣」（長い出典メモの行 2 つを含む）、12〜14 は長い日本語の名前、15 は英字 50 文字の名前。人物: 178「評価T5新人」、179「EvalTfiveLongPersonNameWithoutAnySpacesForTestingX」、180 は 50 文字の日本語の氏名。
- スクリプトとログ: scratchpad の `t5/`。スクリーンショットは `t5-*.png`。

VERDICT: FAIL
RETURN_TO: designer
