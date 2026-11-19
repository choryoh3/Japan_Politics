## 試行 1

VERDICT: FAIL
RETURN_TO: generator

## Evaluator 判定: 不合格 (Sprint 3 / 試行 1)

契約 15 項目と Sprint 1・2 の回帰はすべて合格でした。不合格の理由は 2 つです。1 つは、制御文字を含む氏名で「氏名必須」と「重複不可」の規則をすり抜けられること（機能の欠陥）。もう 1 つは、デザインのクラフトと機能性が基準の 7/10 に届かないことです。

### 不合格理由（重大な順）
1. **NUL 文字を含む氏名で「氏名必須」と「重複不可」をすり抜けられる（機能。戻し先: generator）**
   - 再現手順（画面）:
     1. 管理者で `/persons/new` を開く。
     2. 氏名欄に先頭が NUL の文字列を入れ（Playwright の `fill('\u0000評価UI貼付')`。貼り付けに相当）、よみがなに「ひょうか」を入れて「保存」を押す。
     3. `/persons/189` に移動し、h1 が空（高さ 0）になる（`s3-nul-empty-name.png`）。
   - 再現手順（API）:
     - `POST /api/persons` に `{"name":"\u0000評価先頭","kana":"あ"}` を送ると 201 になり、`GET` の結果は `"name":""`。
     - `{"name":"評価\u0000制御\u0007"}` と `{"name":"評価\u0000別物"}` はどちらも 201 になり、どちらも「評価」と表示される。同じ表示名の人物が 2 件でき、409 の重複チェックが働いていない。
   - 原因: DB には NUL を含んだまま入る（hex で確認）。読み出し時は SQLite の text が NUL で切れる。一意制約は全バイトで比較するので、重複として扱われない。
   - BEL（`\u0007`）と改行もそのまま保存される。
   - 修正指示: `packages/db/src/person-input.ts` の `personInputSchema` で、`name` と `kana` に制御文字（`/\p{Cc}/u`。NUL・改行・タブを含む）があれば拒否する。エラーコードを足して辞書にも登録する。`memo` は改行とタブだけを許し、NUL などは拒否する。あわせて Vitest に NUL・BEL・改行のケースを追加する。
2. **ライト配色の青いボタンにキーボードでフォーカスしても枠が見えない（機能性。戻し先: designer）**
   - 再現手順: ライト配色で `/persons/new` を開き、メモ欄から Tab で「保存」へ移る。
   - 実測: outline は `2px solid rgb(255,255,255)`、offset 3px で白地の上に出るため、背景とのコントラストは 1:1。見えるのは、角が丸から四角に変わることだけ（`s3-light-save-unfocused.png` と `s3-light-save-focused.png` の比較）。
   - 対象: 「登録する」「ログイン」「保存」、削除ダイアログの「削除する」（`s3-light-1280-dialog-kbd.png`）。ダークでは 21:1 で問題なし。
   - 原因: `apps/web/src/app/globals.css` の `.bg-primary:focus-visible { outline-color: var(--color-on-dark) }`。Sprint 1 からあるルールだが、Sprint 3 で青い塗りのボタンが主要操作になり、影響が広がった。
   - 修正指示: このルールを、青い面の上に置かれた要素（`.bg-primary :focus-visible` / `.on-primary :focus-visible`）だけに絞る。キャンバス上の青いボタンは、リンク色（#0064b7、白地で 5.99:1）のリングに戻す。
3. **フォーカス時に丸いボタンが四角くなる（クラフト。戻し先: designer）**
   - `:focus-visible { border-radius: 4px }` が `rounded-full` を上書きし、編集・削除・キャンセル・保存などの丸いボタンがフォーカス中だけ角丸 4px の四角になる（`s3-light-cancel-focused.png`）。
   - 修正指示: `:focus-visible` から `border-radius` を外す（outline は要素の角丸に沿う）。
4. **768px のヘッダーで検索欄が潰れる（クラフト。Sprint 2 の機能の見た目の後退。戻し先: designer）**
   - 実測: 検索欄の幅は未ログインで 98px、管理者で 137px。プレースホルダーは 168px 必要なので「人物・」で切れる（`s3-header-guest-768.png`）。
   - 管理者では「配色を切り替える」だけが 2 行目に落ちる（`s3-header-admin-768.png`）。375px の管理者ヘッダーは高さ 213px。
   - 修正指示: md〜lg の間は検索欄を 2 行目の全幅にする。または、アカウントのナビと配色ボタンを 1 つのまとまりにして折り返しを制御する。

### スプリント契約
- [x] 1. 未ログインのヘッダーに「ログイン」が出る — 合格
  - 3000 と 3100 の `/` と `/persons/2` で確認。
- [x] 2. 登録するとログイン状態になる — 合格
  - 表示名「評価管理者S3」、メール `eval-admin@s3.example.test`、8 文字のパスワードで「登録する」を押した。
  - `/` に移動し、ヘッダーに表示名と「ログアウト」が出た。
  - セッション cookie は HttpOnly・SameSite=Lax で、JS から読めない。
- [x] 3. 7 文字のパスワードは拒否される — 合格
  - 「パスワードは8文字以上にしてください」と出て、ヘッダーは「ログイン」のまま。
  - DB に `eval-short@…` は作られていない。API に直接送っても 400 `PASSWORD_TOO_SHORT`。
- [x] 4. ログアウトでヘッダーが戻る — 合格
  - 「ログアウト」で `/login` に移り、ヘッダーは「ログイン / 新規登録」に戻った。
  - ログアウト前の cookie を curl で使い回すと 401（サーバー側でセッションが破棄されている）。
- [x] 5. 管理者付与コマンド（登録済み）— 合格
  - `docs/project.md` の手順 5 に記載がある。
  - `pnpm admin:grant eval-admin@s3.example.test` で「… を管理者にしました」と出て終了コード 0。大文字のメールでも 0。
- [x] 6. 管理者のヘッダー — 合格
  - ログイン画面からログインすると、ヘッダーに「人物を追加」が出た。
- [x] 7. 管理者付与コマンド（未登録）— 合格
  - 未登録のメールでは「該当するアカウントがありません」と出て終了コード 2。
  - 引数なしは 1。`' OR 1=1 --` を渡しても 2（SQL として解釈されない）。
- [x] 8. 未ログイン・一般ユーザーには操作が出ない — 合格
  - どちらの状態でも `/persons/2` に「編集」「削除」が無く、ヘッダーに「人物を追加」も無い。375・768・1280px で確認。
  - 一般ユーザーが `/persons/new` や `/persons/2/edit` を開くと「この操作は管理者だけができます」と出て、フォームは無い。
  - 未ログインで開くと `/login` へ 307。
- [x] 9. 未ログインで人物追加 API — 合格
  - `POST /api/persons` は 401。curl とブラウザの fetch の両方で確認し、人物は増えていない。
  - PUT と DELETE も 401。3000 番でも 401。
- [x] 10. 一般ユーザーで人物追加 API — 合格
  - POST・PUT・DELETE はいずれも 403。curl と、実際のブラウザ cookie での fetch の両方で確認。
  - 登録時に `"role":"admin"` を送っても `role:"user"` になる。`update-user` で role を変えようとすると 400 `FIELD_NOT_ALLOWED`。
- [x] 11. 人物の追加 — 合格
  - 氏名「評価太郎S3」、よみがな「ひょうかたろう」で保存すると `/persons/178` に移動し、h1 が「評価太郎S3」。
- [x] 12. カタカナのよみがなは拒否される — 合格
  - 「よみがなはひらがなで入力してください」と出て、検索しても 0 件（追加されていない）。
- [x] 13. 人物の改名が反映される — 合格
  - `/persons/2` の「編集」で「加藤勝信評価改名」に変えると、h1 と `/cabinets/7` の財務大臣の行の両方に新しい氏名が出た。
  - 確認後、元の「加藤勝信」に戻した。
- [x] 14. 再起動後も残る — 合格
  - 3100 の本番サーバーを停止して起動し直した後も、人物 178（メモ付き）と改名後の氏名が表示され、管理者のヘッダーに「人物を追加」が出た。
  - dev サーバーは止めない指示のため、再起動は本番サーバーで確認した。保存先は同じ DB ファイルなので、確認している性質は同じ。
- [x] 15. 人物の削除 — 合格
  - `/persons/178` で「削除」を押すとモーダル（`:modal` が true）が開き、「削除する」で `/` に戻った。
  - 検索欄に「評価太郎」を入れると「該当する結果はありません」。`/persons/178` は 404。

### 回帰確認（dev 3000、`local.db`、読み取りのみ）
- **内閣一覧**: `/` は 9 件、新しい順。「現在」は 1 行目だけ、`lang="ja"`。
- **閣僚名簿**: `/cabinets/6` は 19 行。1 行目が内閣総理大臣、2 行目が内閣官房長官。林芳正を含み、各行の官邸の出典リンクはちょうど 1 つ。
- **菅内閣の日付**: 2020年9月16日 / 2021年10月4日。
- **人物ページ**: 第1次石破内閣から加藤勝信をクリックすると `/persons/2` に移り、よみがなと経歴 5 行が出る。
- **横断検索**:
  - 「石破」「かとうかつ」「岸田」で候補が出る。
  - 「岸田」で ↑ と Enter を押すと `/cabinets/2` に移る。
  - 「zzzzz」で「該当する結果はありません」。
- **not-found**: `/cabinets/99999` と `/persons/abc` は 404 で、専用の見出しが出る。
- **配色の切り替え**: `/` と `/persons/99999` の両方で、切り替え → 再読み込みのあとも選んだ配色が残る。

### エッジケース・健全性
- **品質ゲート（自分で実行）**: lint 0、typecheck 0、test 合格（db 20/20、web 14/14）、build 0。
- **入力の境界**:
  - 重複氏名の 409 は、前後の空白付きと修正時を含めて確認した。
  - 51 文字、空、空白だけ、数値、JSON でない本文、範囲外の日付、1001 文字のメモはいずれも 400。
  - 50 文字、絵文字、`%_\` は 201 で正しく表示される。
  - `'";--<script>` はテキストとしてエスケープ表示される。
  - 制御文字は不合格理由 1 のとおり。
- **CSRF・オリジン**: 外部オリジンからの登録・ログインは 403 `INVALID_ORIGIN`。
- **ログイン失敗**: 未登録と誤パスワードはどちらも同じ文言。
- **レート制限**: 連続して失敗すると 429 になり、画面には「処理できませんでした。時間をおいて…」が出る（妥当）。
- **内部情報の漏れ**: スタックトレースやパスの漏れはなし。
- **hydration mismatch（Designer の未確認事項）**: 再現しなかった。
  - dev の新しいコンテキストで `/register`、`/login`、`/persons/new`、`/persons/2`、`/`、not-found を、ライト・ダークそれぞれ 2 回ずつ（計 24 回）読み込み、エラーは 0 件だった。
  - 過去のログに残っていたのは className の差分と `style={{caret-color:"transparent"}}` の差分で、デザイン作業中の HMR とツールが DOM に入れた値が原因とみられる。実害はない。
- **コンソール**: 想定どおりのもの（ログイン失敗の 401、not-found の 404）だけ。5xx はなし。
- **横スクロール**: 375〜1280px のすべてで発生しない。
- **トークン `warning-ink`（#ff6b86）**: 黒地で 7.7:1、14px で基準を満たす。DESIGN.md には未反映なので、ユーザーの承認が必要。これは FAIL の理由にはしていない。
- **ダークの invalid 枠**: #c81b3a が黒地で 3.67:1。非テキストの基準 3:1 は満たす。

### デザイン評価（基準 7/10）
- **デザインの質: 7/10**
  - 見出しは weight 300 にヘアラインを添え、ラベル、補足、エラーの順に階層がはっきりしている。エラーは左の罫線と warning 色で示している。ライト・ダークとも同じ構造で、トークンに沿っている。
  - 根拠: `s3-light-1280-new-err-v2.png`、`s3-dark-375-new-err.png`。
- **オリジナリティ: 7/10**
  - 黒いヘッダー、青い章の帯、キャンバスという流れがフォームとダイアログにも通っている。ダイアログは影なしで、ヘアラインで区切っている。
  - AI スロップの兆候は 0 件。
- **クラフト: 5/10 — 基準未達**
  - フォーカスで丸いボタンが四角になる（理由 3）。
  - 768px で検索欄が 98px / 137px まで潰れる（理由 4）。
  - 管理者ヘッダーで配色ボタンだけが 2 行目に落ちる。
  - 表示名に長さの上限が無く、120 文字超の名前でヘッダーが 197px（1280）/ 333px（375）まで伸びる（`s3-longname-1280.png`）。
- **機能性: 6/10 — 基準未達**
  - ライトで主要ボタンのフォーカス枠が 1:1 で見えない（理由 2）。
  - 削除ダイアログの初期フォーカスが破壊的な「削除する」にある。Esc で閉じた後、フォーカスは「削除」に戻る。
  - 入力欄のアクセシブルネームが「氏名必須」と区切りなしで読まれる。
  - 一方で、エラーは `role=alert` と `aria-invalid` で伝わり、Esc で閉じられ、タッチ領域は 48px ある。

### 改善提案（任意）
- Better Auth 側で表示名に長さの上限を設け、ヘッダーでは省略表示する（generator / designer）。
- 削除ダイアログの初期フォーカスを「キャンセル」にする。「必須」の前に空白か sr-only の区切りを入れる。
- 登録時の `USER_ALREADY_EXISTS` で、アカウントの有無が分かってしまう（仕様上許容なら記録だけ残す）。
- Sprint 2 から持ち越し: localStorage が cookie を上書きする（今回も 3100 で再現した）。

### 再テスト対象（次回、最初に確認する項目）
1. API と画面の両方で、NUL・BEL・改行を含む氏名とよみがなが 400 になること。NUL 入りの重複が作れないこと。
2. ライトで Tab を押し、「保存」「登録する」「ログイン」「削除する」に 3:1 以上のリングが見えること。フォーカス中も丸い形のままであること。
3. 768px（未ログイン・管理者）で、検索欄のプレースホルダーが切れないこと。
4. 契約 15 項目と回帰を再実行すること。

### 評価に使った環境と残したもの
- **DB**:
  - 書き込みを伴う確認（契約 2〜15、境界値、デザイン撮影）は、使い捨て DB `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s3.db` に対して、本番ビルドを 3100 番で起動して行った（`BETTER_AUTH_URL=http://localhost:3100`）。
  - テストデータ（すべて使い捨て DB 内）:
    - アカウント: `eval-user-a`、`eval-admin`、`eval-user-c`、`eval-longname`（いずれも `@s3.example.test`）。
    - 人物: 「評価」で始まる人物、id 179〜189。
  - dev 3000 と `local.db` は読み取りだけ。終了時も user 0 件、session 0 件、persons 87 件、id 2 は「加藤勝信」で、作り直しは不要。
- **サーバー**: 3100 は停止した（PID 6468 と 7137）。dev 3000 は動いたまま（200）。
- **リポジトリ**:
  - `pnpm build` で `apps/web/next-env.d.ts` が変更された（未コミット）。元に戻すか、dev の再生成に任せること。
  - コードとドキュメントは変更していない。
  - Playwright のスナップショットとログは `/home/user/Japan_Politics/.playwright-mcp/` にある（gitignore 対象）。
- **スクリーンショットとログ**:
  - MCP の撮影機能は scratchpad に保存できないため、Playwright のコードから直接保存した。
  - 保存先は `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/` の `s3-*.png`（例: `s3-nul-empty-name.png`、`s3-light-save-focused.png`、`s3-header-guest-768.png`、`s3-light-1280-dialog-kbd.png`）。
  - 同じ場所に、ログ `s3-gates.log`、`s3-build.log`、`s3-prod3100*.log` と、curl の cookie jar `s3-cj-*.txt` もある。
- **ブラウザ**: 閉じた。

VERDICT: FAIL
RETURN_TO: generator

---

## 試行 2

VERDICT: FAIL
RETURN_TO: generator

## Evaluator 判定: 不合格 (Sprint 3 / 試行 2)

契約の 15 項目と、Sprint 1・2 の回帰は、すべて合格しました。前回の不合格項目 1（制御文字）と 2（ライト配色のフォーカスリング）も直っています。

不合格の理由は 2 つです。1 つは、見えない文字だけの氏名で「氏名必須」をすり抜けられることです。前回と同じ症状で、見出し（h1）が空に見える人物ができます。もう 1 つは、前回の項目 3 の「768px の管理者ヘッダー」が直っていないことです。この 2 つ目で、クラフトが基準の 7/10 に届きません。機能とデザインの両方が不合格なので、戻し先は generator です。

### 不合格理由（重大な順）
1. **見えない文字だけの氏名で人物を作れる（機能。戻し先: generator）**
   - 対象はゼロ幅スペースなどの書式文字（`\p{Cf}`）です。今回の修正は制御文字（`\p{Cc}`）だけを対象にしているため、これらは通ります。
   - 再現手順（API）: 管理者で `POST /api/persons` に `{"name":"<U+200B>","kana":"あ"}` を送る。
     - 期待: 400 `nameRequired`（または `nameInvalidChar`）。
     - 実際: 201（id 184）。`/persons/184` の h1 は幅 1184px で文字が見えない（`s3t2-invisible-name-184.png`）。
   - 同じく 201 になった値:
     - ゼロ幅文字だけの氏名 `<U+200B><U+200C><U+200D><U+2060>`（id 187）。
     - `評価<U+00AD>軟`（ソフトハイフン入り）。
     - `<U+202E>評価逆`（文字の並びを右から左に変える制御）。
   - 再現手順（画面）: `/persons/new` の氏名欄に `<U+200B><U+200B>`（貼り付けに相当）、よみがなに「ひょうか」を入れて「保存」を押す。
     - 実際: `/persons/192` に移動し、h1 が空に見える。
   - 見た目が同じ重複も作れる: `評価<U+200B>幅なし` と `評価幅なし` は別人物として登録できる。
   - 修正指示:
     - `packages/db/src/person-input.ts` の `name` に対して、`\p{Cf}`（ゼロ幅文字、ソフトハイフン、文字の向きを変える制御など）を拒否する（または取り除いてから trim と min(1) を通す）。
     - 見えない文字を除くと空になる氏名は `nameRequired` にする。
     - `kana` はひらがなの正規表現で既に拒否されている。
     - Vitest に ゼロ幅スペースだけの氏名、`<U+202E>`、`<U+00AD>` のケースを足す。
2. **768px と 375px の管理者ヘッダーで「配色を切り替える」だけが 1 行を使う（クラフト。前回の項目 3 が未修正。戻し先: designer）**
   - 再現手順: 管理者でログインし、幅 768 で `/` を開く。
   - 実測（`s3t2-header-admin-768.png`、`s3t2-light-768-person.png`）:
     - 1 行目: ロゴ、表示名、「人物を追加」「ログアウト」（y=8〜20）。
     - 2 行目: 「配色を切り替える」だけ（x=48, y=56）。
     - 3 行目: 検索欄。
     - ヘッダーの高さは 157px（未ログインは 109px）。
   - 375px の管理者ヘッダーも、配色ボタンだけの行がある。高さは 213px で、前回から変わっていない（`s3t2-header-admin-375.png`）。
   - 修正指示: `apps/web/src/components/auth-nav.tsx` のアカウントのナビと配色ボタンを 1 つの flex のまとまりにし、折り返す単位を揃える。そのうえで、md では 1 行目に収める（表示名の `max-w` を md で小さくする、`gap-x-6` を詰める、など）。375px では、ナビと配色ボタンを同じ行にまとめて 2 行目にする。

### 前回の不合格項目の再テスト
1. 制御文字 — **合格**（ただし理由 1 の書式文字は残っている）。
   - API: 次はすべて 400 `nameInvalidChar` だった。
     - `\u0000評価先頭`、`評価\u0000制御\u0007`、`評価\u0000別物`。
     - BEL、`\n`、`\r`、`\t`、DEL、NEL を含む氏名。
   - よみがな: NUL・改行・BEL は 400 `kanaInvalidChar`。
   - メモ: NUL・BEL は 400 `memoInvalidChar`。改行・タブ・CRLF は 201 で、そのまま表示される（id 178）。
   - PUT（修正）でも同じ 400 になる。
   - 画面: 先頭が NUL の氏名、BEL を含む氏名、NUL を含むよみがな・メモは、辞書の文言でエラーが出て、保存されない。
   - 正常な値は引き続き 201: 絵文字、`%_\`、50 文字（51 文字は 400 `nameTooLong`）。
   - 前後の改行は trim で取り除かれて保存される（hex で確認）。
2. ライト配色のリング — **合格**。
   - 「保存」「登録する」「ログイン」「削除する」は、いずれも `2px solid #0064b7`、offset 3px で、白地に対して 5.99:1。
   - フォーカス中も、border-radius は rounded-full のまま（`s3t2-light-1280-new-focus.png`、`s3t2-light-1280-dialog-kbd.png`）。
   - ダークでは #53b1ff（`s3t2-dark-1280-dialog-kbd.png`）。
   - 黒いヘッダー上の検索欄・配色ボタンは白、リンクは #53b1ff。青い帯の上の「内閣一覧へ戻る」は白。
3. 768px のヘッダー — **一部不合格**。
   - 検索欄は全幅になった（768 で 672px、1024 で 928px）。プレースホルダーは必要幅 168px に対して足りており、切れない。
   - 長い表示名（133 文字）は省略表示され、ヘッダーの高さは管理者と同じ（1280 で 61px）。
   - 配色ボタンが 1 行を使う問題は残っている（理由 2）。

### スプリント契約（本番ビルド 3100 番、使い捨て DB）
- [x] 1. 未ログインのヘッダーに「ログイン」が出る — 合格（`/`、`/persons/2`）
- [x] 2. 登録するとログイン状態になる — 合格
  - 表示名「評価一般UI」と 8 文字のパスワードで登録すると `/` に移り、ヘッダーに表示名と「ログアウト」が出た。
- [x] 3. 7 文字のパスワードは拒否される — 合格
  - 「パスワードは8文字以上にしてください」が出て、ヘッダーは「ログイン」のまま。DB にアカウントは作られていない。
- [x] 4. ログアウトでヘッダーが戻る — 合格（`/login` へ移り、ヘッダーは「ログイン」に戻った）
- [x] 5. 管理者付与コマンド（登録済み）— 合格（「… を管理者にしました」、終了コード 0）
- [x] 6. 管理者のヘッダー — 合格（「人物を追加」が出る）
- [x] 7. 管理者付与コマンド（未登録）— 合格
  - 「該当するアカウントがありません」と出て、終了コード 2。引数なしは 1。
- [x] 8. 未ログイン・一般ユーザーには操作が出ない — 合格
  - どちらの状態でも「編集」「削除」「人物を追加」は 0 件。
  - 一般ユーザーで `/persons/new` と `/persons/2/edit` を開くと「この操作は管理者だけができます」と出る。
  - 未ログインで `/persons/new` を開くと `/login` に移る。
- [x] 9. 未ログインで人物追加 API — 合格（401。DELETE も 401。3000 番でも 401）
- [x] 10. 一般ユーザーで人物追加 API — 合格
  - POST・PUT・DELETE はすべて 403。件数は増えていない。
  - 登録時に `"role":"admin"` を送っても `role:"user"` になる。
- [x] 11. 人物の追加 — 合格（「評価花子T2」で保存すると `/persons/191` に移り、h1 が一致）
- [x] 12. カタカナのよみがなは拒否される — 合格（「よみがなはひらがなで入力してください」が出て、ページは移動しない）
- [x] 13. 人物の改名が反映される — 合格
  - `/persons/2` を「加藤勝信評価改名T2」に変えると、h1 と `/cabinets/7` の両方に新しい氏名が出た。
  - 確認後、元に戻した。
- [x] 14. 再起動後も残る — 合格
  - 3100 番を停止して起動し直した後も、改名後の氏名、id 178 のメモ（改行付き）、管理者のヘッダーの「人物を追加」が残っていた。
- [x] 15. 人物の削除 — 合格
  - ダイアログは `:modal`。「削除する」で `/` に戻り、検索欄に「評価花子」を入れると「該当する結果はありません」。`/persons/191` は 404。

### 回帰確認（dev 3000、`local.db` は読み取りのみ）
- **内閣一覧**: 9 件、新しい順で、「現在」は 1 行目だけ。
- **閣僚名簿**: `/cabinets/6` は 19 行。1 行目が内閣総理大臣で、林芳正を含む。各行の出典リンクはちょうど 1 つ。
- **菅内閣の日付**: 2020年9月16日 / 2021年10月4日。
- **人物ページ**: `/persons/2` は「加藤勝信」で、経歴 5 行。
- **横断検索**:
  - 「かとうかつ」で加藤勝信が候補に出る。
  - 「岸田」で ↑ と Enter を押すと `/cabinets/2` に移る。
  - 「zzzzz」で「該当する結果はありません」。
- **not-found**: `/cabinets/99999` と `/persons/abc` は 404 で、専用の見出しが出る。
- **配色**: 切り替えて再読み込みした後も、選んだ配色が残る。
- **フォーカスリング**: 黒いヘッダー上、青い帯の上、白・黒のキャンバス上のいずれも、3:1 以上を保っている。
- **権限**: 外部オリジンからの登録は 403（Sprint 3 試行 1 で確認済み。今回は登録 API の role 混入を再確認した）。

### エッジケース・健全性
- **品質ゲート（自分で実行）**: lint 0、typecheck 0、test 合格（db 22/22、web 14/14）、build 0。
- **コンソール**: 削除後の 404 と not-found の 404 だけ（想定どおり）。サーバーログに 5xx・例外はない。
- **シークレットの漏れ**: なし。
- **横スクロール**: どの幅でも発生しない。
- **補足**（FAIL 理由ではない）:
  - `/api/persons` は Origin を検査していない。`Origin: https://evil.example` と管理者の cookie を付けた curl は 201 になった。
  - ただし、cookie は SameSite=Lax で、本文は JSON なので、ブラウザ経由の CSRF は成立しにくい。

### デザイン評価（基準 7/10。375 / 768 / 1024 / 1280、ライト / ダーク）
- **デザインの質: 7/10**
  - 見出しは weight 300 にヘアラインを添え、ラベル、補足、エラーの順に階層がはっきりしている。エラーは左の罫線と warning 色で示している（`s3t2-dark-375-new-err.png`）。
  - 「氏名 必須」の区切りも入った。
- **オリジナリティ: 7/10**
  - 黒いヘッダー、青い章の帯、キャンバスという流れが、フォームとダイアログにも通っている（`s3t2-light-768-person.png`）。
  - AI スロップの兆候は 0 件。
- **クラフト: 6/10 — 基準未達**
  - 768 と 375 の管理者ヘッダーで、配色ボタンだけの行が残る（理由 2）。
  - フォーカス中に丸い形が四角くなる問題と、検索欄が潰れる問題は解消した。
- **機能性: 7/10**
  - リングはライト・ダークとも見え、エラーは role=alert で伝わる。
  - 見えない氏名の人物ができる点は、機能の不合格として扱った（理由 1）。

### 改善提案（FAIL の理由にしない）
- 表示名のサーバー側の長さ上限。
- 削除ダイアログの初期フォーカスがまだ「削除する」にある。キャンセルにすると安全。
- `ThemeToggle` を cookie 優先にする。
- 管理者の書き込み API で Origin を検査する（多層防御として）。

### 再テスト対象（次回、最初に確認する項目）
1. ゼロ幅スペース（U+200B）だけの氏名、ゼロ幅文字 4 種だけの氏名、`<U+202E>評価逆`、`評価<U+00AD>軟` が API と画面の両方で 400 になること。
   - `評価<U+200B>幅なし` と `評価幅なし` の重複が作れないこと。
   - 絵文字（ZWJ を含む家族の絵文字などの扱いも確認）、`%_\`、50 文字は引き続き 201 になること。
2. 768px と 375px の管理者ヘッダーで、「配色を切り替える」だけの行がないこと。ヘッダーの高さ（768 で 109px 前後が目安）。
3. 契約 15 項目、ライト・ダークのリング、回帰を再実行すること。

### 評価に使った環境と残したもの
- **使い捨て DB**: `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s3-t2.db`
  - アカウント: `eval-admin2`（管理者）、`eval-user2`、`eval-longname2`（管理者、133 文字）、`eval-role`、`eval-ui-user`。いずれも `@s3t2.example.test`。
  - 人物: id 178〜192（「評価」で始まるものと、見えない氏名の 184・187・192）。191 は削除済み。
- **`local.db`**: 読み取りだけ。user 0、session 0、persons 87、id 2 は「加藤勝信」で、変更なし。
- **サーバー**:
  - 3100 番は停止した。ただし、PID 2243 が親 PID 1 の defunct（ゾンビ）として残っている。ポートは解放済み。
  - dev 3000 は動いたまま（200）。
  - 誤って Playwright の Chrome のネットワークサービス（PID 1767）を kill したが、その後のブラウザ操作は正常だった。
- **リポジトリ**:
  - `pnpm build` で `apps/web/next-env.d.ts` が変更された（未コミット）。元に戻すか、dev の再生成に任せること。
  - コードとドキュメントは変更していない。
- **スクリーンショットとログ**: `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/` の `s3t2-*.png` と `s3t2-*.log`。主なもの:
  - `s3t2-invisible-name-184.png`
  - `s3t2-header-admin-768.png`
  - `s3t2-header-admin-375.png`
  - `s3t2-light-1280-new-focus.png`
  - `s3t2-light-1280-dialog-kbd.png`
  - `s3t2-dark-1280-dialog-kbd.png`
  - `s3t2-header-long-1280.png`
- **ブラウザ**: 閉じた。

VERDICT: FAIL
RETURN_TO: generator

---

## 試行 3

VERDICT: FAIL
RETURN_TO: generator

## Evaluator 判定: 不合格 (Sprint 3 / 試行 3)

契約の 15 項目、Sprint 1・2 の回帰、権限まわり、ヘッダーのデザイン修正は、すべて合格でした。前回指摘した値（`<U+200B>` など）も、すべて 400 で拒否されます。

不合格の理由は 1 つです。見えない文字だけの氏名で、人物を作れる状態が残っています。前回と同じ症状で、見出しが空に見える人物ができ、見た目が同じ人物を重複して登録することもできます。今回の修正が書式文字（`\p{Cf}`）だけを対象にしていて、それ以外の見えない文字が素通りするためです。あわせて、generator の絵文字の扱いには、正しい絵文字を拒否する誤りがあります。デザインの 4 基準はすべて 7/10 で、基準に届いています。戻し先は generator です（designer の再作業は不要）。

### 不合格理由
1. **見えない文字だけの氏名と、見た目が同じ重複を、まだ作れる（機能。戻し先: generator）**
   - **画面での再現**: 管理者で `/persons/new` を開き、氏名に `<U+3164><U+3164>`（ハングルの「見えない字」）、よみがなに「ひょうか」を入れて「保存」を押す。
     - 実際: `/persons/195` に移り、h1 が空に見える（`s3t3-invisible-hangul.png`）。
   - **API で 201 になった見えない文字だけの氏名**（`POST /api/persons`、管理者）:

     | 氏名 | 文字 | id |
     |---|---|---|
     | `<U+3164>` | ハングルの見えない字 | 183 |
     | `<U+2800><U+2800>` | 点字の空白 | 184 |
     | `<U+034F>` | 結合用の見えない記号 | 185 |
     | `<U+FE0F>` | 異体字セレクタ | 186 |

     - schema を直接呼ぶと、`<U+FFA0>`、`<U+115F>`、`<U+0301>` だけの氏名も通る。
   - **見た目が同じ重複**（両方 201。検索候補に同じ見た目で 2 件並ぶ。`s3t3-dup-vs.png`）:

     | 先に作った氏名 | 重複して作れた氏名 | 違い |
     |---|---|---|
     | `評価が濁T3` | `評価か<U+3099>濁T3` | 濁点を後から付けた形。NFC 正規化がない |
     | `評価異体T3` | `評価異体T3<U+FE0E>` | 異体字セレクタ |
     | `評価😀T3` | `評価😀<U+E0061>T3` | タグ文字 |
     | `評価😀😀T3` | `評価😀<U+200D>😀T3` | 意味のない ZWJ |

     - `評価<U+180B>`（モンゴル文字の異体字セレクタ）と `評価<U+E0100>` も、schema で通ることを確認した。
   - **generator の判断の評価**:
     - ZWJ について: 「前後が絵文字のときだけ許す」では、肌の色付きの正しい絵文字 `👩🏽<U+200D>💻` が 400 `nameInvalidChar` になる。肌の色の記号（U+1F3FB–1F3FF）が `Extended_Pictographic` に含まれないためで、正常な氏名を拒否している。逆に、意味のない並びの `😀<U+200D>😀` は通る。
     - タグ文字について: 「絵文字の直後なら許す」では、どの絵文字の後でも通るので、見た目の重複が作れる。本来は黒旗（U+1F3F4）の直後で、`<U+E007F>` で終わる並びだけを許すべき。
     - 判断は妥当ではない。
   - **原因**: `packages/db/src/person-input.ts` の判定が、空白と `\p{Cf}` だけを見ていて、次の文字を見落としている。
     - 既定で無視される文字（Default_Ignorable_Code_Point）: U+3164、U+FFA0、U+115F、U+034F、U+FE00–FE0F、U+180B–180F、U+E0100–E01EF。
     - 点字の空白（U+2800）。
     - 結合文字だけの並び（`\p{M}`）。
     - 正規化していないこと。
   - **修正指示**（`packages/db/src/person-input.ts`）:
     1. `name` は trim の前に `.normalize("NFC")` をかけてから検証・保存する。こうすると、濁点を後から付けた形も、通常の「が」と同じ文字として重複チェックされる。
     2. 見えない文字を `\p{Default_Ignorable_Code_Point}` と U+2800 で定義する（`\p{Cf}` の代わり）。氏名にこれらが含まれていれば `nameInvalidChar` にする。
     3. 例外として許すのは、絵文字の書記素の中にある次の 3 つだけにする。
        - ZWJ（直前が絵文字・肌の色の記号（`\p{Emoji_Modifier}`）・U+FE0F で、直後が絵文字のとき）。
        - U+FE0F（絵文字の直後のとき）。
        - タグ文字（U+1F3F4 の直後で、`<U+E007F>` で終わる並び）。
     4. `hasVisibleChar` は、見えない文字・空白・`\p{M}` を除いて 1 文字以上残るかで判定する。残らなければ `nameRequired`。
     5. メモにも同じ見えない文字の判定を使う。
     6. Vitest に次のケースを足す。
        - 400 になるべき: `<U+3164>`、`<U+2800>`、`<U+034F>`、`<U+FE0F>` 単体、`評価<U+FE0E>`、`😀<U+E0061>`、`😀<U+200D>😀`。
        - 201 になるべき: `👩🏽<U+200D>💻`。
        - 重複になるべき: NFC で同じになる氏名どうし（409 `nameDuplicate`）。

### 前回の不合格項目の再テスト
1. **指定された見えない文字** — 合格（API と画面の両方。本番ビルド 3100、使い捨て DB）
   - API:
     - `<U+200B>` と `<U+200B><U+200C><U+200D><U+2060>` は 400 `nameRequired`。
     - `<U+202E>評価逆`、`評価<U+00AD>軟`、`評価<U+200B>幅なしT3` は 400 `nameInvalidChar`。
     - `評価<U+200B>幅なしT3` は、`評価幅なしT3`（id 178）を作る前も後も 400。
     - `め<U+200B>も` のメモは 400 `memoInvalidChar`。改行・タブのメモは 201。
   - 画面:
     - `<U+200B><U+200B>` は「氏名を入力してください」と出て、保存されない。
     - RLO と SHY は「氏名に使えない文字（制御文字・改行・見えない文字など）が含まれています」と出て、保存されない。
     - 画面から `評価幅なしT3` をもう一度入れると「同じ氏名の人物が既に登録されています」。
   - 正常な値は 201:
     - 家族の絵文字（ZWJ 入り。id 179）、イングランドの旗（タグ文字入り。id 180）、`%_\`（id 181）、50 文字（id 182）。
     - 🏳️‍🌈、🏴‍☠️、👁️‍🗨️、🇯🇵 も schema で通る。
     - 51 文字は 400 `nameTooLong`。
   - ただし、理由 1 のとおり、それ以外の見えない文字と `👩🏽<U+200D>💻` で不合格。
2. **管理者ヘッダー** — 合格
   - 「配色を切り替える」だけの行はない。
   - ヘッダーの高さ（未ログイン・一般ユーザー・管理者・133 文字の表示名の管理者で、すべて同じ）:

     | 幅 | 高さ |
     |---|---|
     | 320 | 169px |
     | 375 | 165px |
     | 768 | 109px |
     | 1024 | 109px |
     | 1280 | 61px |

   - どの幅でも横スクロールは出ない。長い表示名は「評価長い表…」と省略表示される（`s3t3-long-375.png`）。
   - 要素の並び:
     - 768: 1 行目がロゴ・配色・表示名・人物を追加・ログアウト、2 行目が全幅の検索欄（672px）。
     - 375: 1 行目がロゴ・配色、2 行目がアカウント、3 行目が検索欄。
     - 1280: 1 行で、検索欄が右端（384px）。
   - Tab の順（ロゴ → 配色 → 人物を追加 → ログアウト → 検索）は見た目の順と一致する。
   - 並び替えの是非: 検索はヘッダーに残っていて使える（Sprint 2 の候補表示・↑ と Enter での移動・該当なし、を回帰で確認）。並び替えは妥当と判断した。
   - 320px: 崩れはないが、ロゴが「日本の人事デー／タベース」と語の途中で 2 行に折れる（軽微。改善提案へ）。
3. **フォーカスリング（実測）** — 合格

   | 場所 | ライト | ダーク |
   |---|---|---|
   | 黒いヘッダー上のリンク（#53b1ff） | 9.10:1 | 9.10:1 |
   | 黒いヘッダー上の配色ボタン・検索欄（白） | 21:1 | 21:1 |
   | 青い帯（#0070d1）の上の「内閣一覧へ戻る」（白） | 約 5.1:1（`s3t3-light-back-focus.png`） | — |
   | キャンバス上の「編集」「削除」・内閣リンク | #0064b7 で 5.99:1 | #53b1ff で 9.10:1 |

### スプリント契約（本番ビルド 3100、使い捨て DB）
- [x] 1. 未ログインのヘッダーに「ログイン」が出る — 合格（`/` と `/persons/2` で確認）
- [x] 2. 登録するとログイン状態になる — 合格
  - `/register` で 8 文字のパスワードで登録すると `/` に移り、ヘッダーに「評価UI一般T3」と「ログアウト」が出た。
- [x] 3. 7 文字のパスワードは拒否される — 合格
  - 「パスワードは8文字以上にしてください」が出て、ヘッダーは「ログイン」のまま。
- [x] 4. ログアウトでヘッダーが戻る — 合格（「ログイン」「新規登録」に戻った）
- [x] 5. 管理者付与コマンド（登録済み）— 合格（「eval-admin3@s3t3.example.test を管理者にしました」、終了コード 0）
- [x] 6. 管理者のヘッダー — 合格（「人物を追加」が出る）
- [x] 7. 管理者付与コマンド（未登録）— 合格（「該当するアカウントがありません」、終了コード 2。引数なしは 1）
- [x] 8. 未ログイン・一般ユーザーには操作が出ない — 合格
  - どちらの状態でも「編集」「削除」「人物を追加」は 0 件。
  - 一般ユーザーで `/persons/new` と `/persons/2/edit` を開くと「この操作は管理者だけができます」。
  - 未ログインで `/persons/new` を開くと `/login` に移る。
- [x] 9. 未ログインで人物追加 API — 合格（POST・PUT・DELETE はすべて 401）
- [x] 10. 一般ユーザーで人物追加 API — 合格
  - POST・PUT・DELETE はすべて 403。
  - 登録時に `"role":"admin"` を送っても `role:"user"` になる。
  - 人物の件数は増えていない（105 件 = 初期データ 87 件 + 評価で作った 19 件 − 削除 1 件）。
- [x] 11. 人物の追加 — 合格（「評価花子T3」で保存すると `/persons/196` に移り、h1 が一致）
- [x] 12. カタカナのよみがなは拒否される — 合格（「よみがなはひらがなで入力してください」が出て、ページは移動しない）
- [x] 13. 人物の改名が反映される — 合格
  - `/persons/2` を「加藤勝信評価改名T3」にすると、h1 と `/cabinets/7` の名簿の両方に反映された。
  - 確認後、元に戻した。
- [x] 14. 再起動後も残る — 合格
  - 3100 を停止して起動し直した後も、改名後の氏名、id 178、管理者のヘッダーの「人物を追加」が残っていた。
- [x] 15. 人物の削除 — 合格
  - ダイアログは `:modal`。「削除する」で `/` に戻った。
  - 検索欄に「評価花子」を入れると「該当する結果はありません」。`/persons/196` は 404。

### 回帰確認（dev 3000、`local.db` は読み取りのみ）
- **内閣一覧**: 9 件。「現在」は 1 行目（第2次高市内閣）だけ。
- **菅内閣の日付**: 2020年9月16日 / 2021年10月4日。
- **閣僚名簿**: `/cabinets/6` は 19 行。1 行目は内閣総理大臣で、林芳正を含む。各行の出典リンクはちょうど 1 つ。
- **人物ページ**: `/persons/2` は「加藤勝信」で、経歴 5 行。
- **横断検索**:
  - 「かとうかつ」で加藤勝信が候補に出る。
  - 「岸田」で ↑ と Enter を押すと `/cabinets/2` に移る。
  - 「zzzzz」で「該当する結果はありません」。
- **not-found**: `/cabinets/99999` と `/persons/abc` は 404 で、専用の見出しが出る。
- **配色**: 切り替えて再読み込みした後も、選んだ配色（dark）が残る。

### エッジケース・健全性
- **品質ゲート（自分で実行）**: lint 0、typecheck 0、test 合格（db 26/26、web 14/14）、build 0。
- **コンソール**: エラーは、削除後の 404 と not-found の 404 だけ（想定どおり）。
- **サーバーログ**: 5xx・例外はない。
- **シークレット**: 漏れていない（登録 API の応答に入る token は、報告では伏せた）。

### デザイン評価（基準 7/10）
- **デザインの質: 7/10**
  - 見出しは weight 300、エラーは左の罫線と警告色、「必須」のラベルと、階層がはっきりしている（`s3t3-dark-375-new-err.png`）。
- **オリジナリティ: 7/10**
  - 黒いヘッダー、青い章の帯、キャンバスという流れが一貫している。AI スロップの兆候は 0 件。
- **クラフト: 7/10**
  - 配色ボタンだけの行がなくなり、768 の 1 行目に収まった（`s3t3-admin-768.png`）。
  - 減点: 320px でロゴが語の途中で折れる。長い表示名を省略したとき、右の余白が広く見える。
- **機能性: 7/10**
  - Tab の順が見た目と一致し、リングはどこでも 3:1 以上。エラーは `role=alert` で伝わる。

### 改善提案（FAIL の理由にしない）
- 320px のロゴの折り返し（`whitespace-nowrap` にして文字を縮める、など）。
- 表示名のサーバー側の長さ上限。
- 削除ダイアログの初期フォーカスが、まだ「削除する」にある。
- `ThemeToggle` を cookie 優先にする。
- 書き込み API で Origin を検査する。

### 再テスト対象（次回、最初に確認する項目）
1. 次が API と画面の両方で 400 になること。
   - 見えない文字だけの氏名: `<U+3164>`、`<U+FFA0>`、`<U+2800>`、`<U+034F>`、`<U+FE0F>` 単体、`<U+0301>` 単体。
   - 見た目の重複を作れる氏名: `評価<U+FE0E>`、`評価<U+180B>`、`評価<U+E0100>`、`評価😀<U+E0061>`、`評価😀<U+200D>😀`。
2. NFC で同じになる氏名（`評価が` と `評価か<U+3099>`）が 409 `nameDuplicate` になること。
3. 次が 201 になること。
   - `👩🏽<U+200D>💻`。
   - 家族の絵文字、イングランドの旗、🏳️‍🌈、`%_\`、50 文字。
4. 今回挙げた値（`<U+200B>`、RLO、SHY など）が、引き続き 400 になること。
5. 契約 15 項目と回帰を再実行すること。

### 評価に使った環境と残したもの
- **使い捨て DB**: `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s3-t3.db`
  - アカウント: `eval-admin3`（管理者）、`eval-user3`、`eval-ui3`、`eval-long3`（管理者、133 文字の表示名）、いずれも `@s3t3.example.test`。
    - ほかに、最初の登録でメールアドレスの変数を誤って空にした `eval-@s3t3.example.test` が 1 件ある。
  - 人物: id 178〜196。196 は削除済み。183〜186 と 195 は見えない氏名。
- **`local.db`**: 読み取りだけ。persons 87、user 0、id 2 は「加藤勝信」で、変更なし。
- **サーバー**: 3100 は停止した（next-server は dev 3000 の 1 つだけ残っている）。dev 3000 は動いたまま（200）。
- **リポジトリ**:
  - `pnpm build` で `apps/web/next-env.d.ts` が変更された（`.next/dev/types` が `.next/types` になった。未コミット）。元に戻すか、dev の再生成に任せること。
  - Playwright MCP が `.playwright-mcp/` に snapshot と console のログを書いた（gitignore 済み）。
  - 評価の開始時点で、未コミットの `apps/web/src/app/layout.tsx` と `apps/web/src/components/search-box.tsx`（designer の変更）があった。触っていない。
  - コードとドキュメントは変更していない。
- **スクリーンショット**: `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/` にある。
  - `s3t3-invisible-hangul.png`
  - `s3t3-dup-vs.png`
  - `s3t3-dup-emoji.png`
  - `s3t3-admin-{320,375,768,1024,1280}.png`
  - `s3t3-anon-*.png`
  - `s3t3-long-*.png`
  - `s3t3-light-back-focus.png`
  - `s3t3-dark-focus.png`
  - `s3t3-dark-375-new-err.png`
  - `s3t3-delete-dialog.png`
- **ブラウザ**: 閉じた。

VERDICT: FAIL
RETURN_TO: generator

---

## 試行 4

VERDICT: FAIL
RETURN_TO: generator

## Evaluator 判定: 不合格 (Sprint 3 / 試行 4)

All 15 contract items pass, and so does everything that failed in attempt 3. The sprint still fails: two new gaps in the name check let me create a person whose heading looks empty, and two people whose names look the same. Both are the kind of defect you said counts as a functional failure.

### 不合格理由（重大な順）
1. **A person with an empty heading can be created, and a "same-looking" duplicate is possible: U+FFF9–U+FFFB and U+FFFC.**
   - **Steps (production build on 3100, throwaway DB, admin):**
     - Open `/persons/new`, enter `<U+FFFB>` as the name and `ひょうかがめん` as the reading, press 保存.
     - It moves to `/persons/210`. The h1 text is `<U+FFFB>` and its drawn width is 0px.
     - The blue band shows only the reading (`s3t4-ui-fffb-created.png`, `s3t4-fff9-empty-heading.png`).
   - **Same result through the API (POST `/api/persons` returns 201):**
     - `<U+FFF9>` (id 195), `<U+FFFA>` (id 196) and `<U+FFFC>` (id 208) each get an h1 with width 0.
     - `評価T4` (id 197) and `評価T4<U+FFF9>` (id 198) are both created and look identical (`s3t4-h1-197.png` and `s3t4-h1-198.png`). `評価T4<U+FFFB>` (id 199) behaves the same.
   - **Expected:** an empty-looking name returns 400 `nameRequired`; a hidden character inside a name returns 400 `nameInvalidChar`.
   - **Which requirement it breaks:** the required name (「氏名（必須）」 under 実装する機能) and the duplicate-name rule (`nameDuplicate`). Contract item 11 is also affected: the heading is meant to show the name that was entered.
   - **Likely cause:**
     - In `packages/db/src/person-input.ts`, `INVISIBLE_CHAR_PATTERN` is `[\p{Default_Ignorable_Code_Point}⠀]`.
     - The Unicode standard's definition of Default_Ignorable explicitly leaves out U+FFF9–FFFB, U+13430–1343F and the Arabic prefix signs (Prepended_Concatenation_Mark). So these are format characters (category Cf) that are not "ignorable".
     - U+FFFC is in the symbol category (So), so it is not caught either.
   - **Fix:**
     - Change `INVISIBLE_CHAR_PATTERN` and the class removed in `hasVisibleChar` to `[\p{Default_Ignorable_Code_Point}\p{Cf}⠀￼]`.
     - Adding all of Cf is safe: the ZWJ and tag characters inside valid emoji are already removed by `RGI_EMOJI_PATTERN` first.
     - Add Vitest cases expecting 400 for: `<U+FFF9>`, `<U+FFFA>`, `<U+FFFB>`, `<U+FFFC>`, `評価<U+FFF9>`.
2. **Different whitespace makes names that look the same.**
   - **Steps (API on 3100, each returns 201):**
     - `評価 空白T4` (U+0020, id 191)
     - `評価<U+00A0>空白T4` (id 192)
     - `評価  空白T4` (two U+0020, id 193)
   - All three draw an h1 exactly 278.9px wide. HTML collapses runs of spaces and draws a non-breaking space like a normal one, so they cannot be told apart (`s3t4-h1-192.png` and `s3t4-h1-193.png`).
   - `評価<U+2028>行T4` (id 201) and `評価<U+2029>段T4` (id 202) are also created. They display like a space, even though a newline in a name is rejected.
   - **Expected:** names that look the same give 409 `nameDuplicate` (or the input is rejected). Line and paragraph separators are rejected like a newline.
   - **Fix (in `normalizeName` or before the check):**
     - Reject U+2028 and U+2029 like a newline (`nameInvalidChar`).
     - Replace whitespace other than U+3000 (e.g. U+00A0, U+2000–U+200A, U+202F, U+205F) with U+0020, then collapse runs of U+0020 into one.
     - Keep the full-width space U+3000 as it is. It is common between family and given names, is visibly wider, and HTML does not collapse it.
     - Alternatively, reject non-standard spaces and consecutive spaces with 400. Either way, add Vitest cases.

### 前回の不合格項目の再テスト（すべて合格。API と画面の両方、本番 3100）
1. **Invisible-only names**, all 400 `nameRequired` through the API, PUT included. On screen each shows 「氏名を入力してください」 and nothing is saved:
   - `<U+3164>`, `<U+3164><U+3164>`, `<U+FFA0>`, `<U+2800>`, `<U+034F>`, `<U+FE0F>` alone, `<U+0301>` alone, `<U+115F>`, and also `<U+1160>`.
2. **Names that could make a lookalike duplicate**, all 400 `nameInvalidChar`. On screen each shows 「氏名に使えない文字（制御文字・改行・見えない文字など）が含まれています」:
   - `評価<U+FE0E>`, `評価<U+180B>`, `評価<U+E0100>`, `評価😀<U+E0061>`, `評価😀<U+200D>😀`, `評価😀<U+FE0F>`.
3. **NFC duplicates (two names that become identical after standard Unicode normalization), both directions**:
   - Create `評価が` first (201), then send `評価か<U+3099>`: 409.
   - Create `評価き<U+3099>` first (201), then send `評価ぎ`: 409.
   - Through the screen, `評価か<U+3099>` shows 「同じ氏名の人物が既に登録されています」. PUT gives 409 too.
4. **These return 201:**
   - `👩🏽<U+200D>💻`, the family emoji, the England flag, 🏳️‍🌈, 🏴‍☠️, 👁️‍🗨️, 🇯🇵, `%_\`, and a 50-character name. A 51-character name returns 400 `nameTooLong`.
   - `評価髙橋﨑山齋藤邊渡ヶ々ーカタカナがぎぐ` returns 201.
5. **Earlier rejected values are still 400:**
   - `<U+200B>`, `<U+202E>`, `<U+00AD>`, NUL, BEL, newline, `<U+0085>`.
   - In the memo, `<U+200B>` and `<U+3164>` give 400 `memoInvalidChar`; a memo with newlines and tabs gives 201.
6. **PUT and seed data:**
   - PUT applies the same checks: `<U+3164>`, `<U+0301>` and `評価PUT<U+FE0E>` give 400, the NFC duplicate gives 409, a valid name gives 200.
   - I re-saved all 87 seed people with PUT using their current values: all 87 returned 200, and both the person page and the edit page loaded with 200 for every one.
7. **Browser support (RGI_Emoji):**
   - On 3100, `/persons/new` and `/persons/2/edit` produced no console messages at all and no page errors (HeadlessChrome 153).
   - On dev 3000, `new RegExp("\\p{RGI_Emoji}","gv")` builds without error.
   - On dev 3000 I could not open the admin-only form pages: that needs a registered account, which would mean writing to `local.db`.

### スプリント契約（本番ビルド 3100、使い捨て DB）
- [x] 1. **Logged out, the header shows 「ログイン」** — pass (checked on `/` and `/persons/2`).
- [x] 2. **Registering logs you in** — pass. After registering with an 8-character password, it moves to `/`; the header shows 「評価UI一般T4」 and 「ログアウト」.
- [x] 3. **A 7-character password is rejected** — pass. 「パスワードは8文字以上にしてください」 is shown and the header stays 「ログイン」.
- [x] 4. **Logging out restores the header** — pass (back to 「ログイン」 and 「新規登録」).
- [x] 5. **Admin grant command, registered address** — pass. It printed 「eval-admin4@s3t4.example.test を管理者にしました」 and exited with code 0.
- [x] 6. **Admin header** — pass (「人物を追加」 is shown).
- [x] 7. **Admin grant command, unregistered address** — pass. It printed 「該当するアカウントがありません」 and exited with code 2. With no argument it exits with code 1.
- [x] 8. **Logged-out and regular users see no edit controls** — pass.
  - In both states, 「編集」, 「削除」 and 「人物を追加」 appear 0 times.
  - A regular user opening `/persons/new` or `/persons/2/edit` sees 「この操作は管理者だけができます」.
  - A logged-out user opening `/persons/new` is sent to `/login`.
- [x] 9. **Logged-out API calls** — pass (POST, PUT and DELETE all return 401).
- [x] 10. **Regular-user API calls** — pass.
  - POST, PUT and DELETE all return 403, and no person is added (searching the name returns 0 hits).
  - Sending `"role":"admin"` at registration still gives `role: user`.
- [x] 11. **Adding a person** — pass. Saving 「評価花子T4」 moves to `/persons/211` and the h1 matches.
- [x] 12. **A katakana reading is rejected** — pass. 「よみがなはひらがなで入力してください」 is shown, the page does not move, and nothing is added.
- [x] 13. **Renaming shows everywhere** — pass. `/persons/2` renamed to 「加藤勝信評価改名T4」 shows in its h1 and in the `/cabinets/7` member list. I then changed it back.
- [x] 14. **Data survives a restart** — pass. After stopping and restarting 3100, the new name, id 211 and the admin's 「人物を追加」 were all still there.
- [x] 15. **Deleting a person** — pass.
  - The confirmation dialog is a true modal (`:modal`); its text is 「評価花子T4を削除します。この操作は取り消せません。」.
  - 「削除する」 returns to `/`. Searching 「評価花子」 shows 「該当する結果はありません」, and `/persons/211` returns 404.
  - Deleting a person who has a career record (person 2) returns 409 `hasCareers`.

### 回帰確認（dev 3000、`local.db` は読み取りのみ）
- **Cabinet list:** 9 rows. 「現在」 appears only on row 1 (第2次高市内閣).
- **Suga cabinet dates:** 2020年9月16日 / 2021年10月4日.
- **`/cabinets/6`:** 19 rows. Row 1 is 内閣総理大臣 (石破茂), and 林芳正 is included. Every row has exactly one source link.
- **`/persons/2`:** 「加藤勝信」, with 5 career rows.
- **Search:**
  - 「かとうかつ」 suggests 加藤勝信.
  - 「岸田」 then ↑ and Enter goes to `/cabinets/2`.
  - 「zzzzz」 shows 「該当する結果はありません」.
- **Not found:** `/cabinets/99999` and `/persons/abc` return 404 with their own headings.

### エッジケース・健全性
- **Quality gates (I ran them myself):** lint 0, typecheck 0, tests pass (db 30/30, web 14/14), build 0.
- **Console:**
  - The form pages are clean.
  - The only errors are expected resource-load messages: the 409 on a duplicate name and the 404 on the not-found pages.
- **Server logs:** no 5xx and no exceptions.
- **Secrets:** nothing leaked.
- **Other findings (not reasons for failure; improvement suggestions):**
  - **Old-form kanji are converted.** NFC turns compatibility ideographs into the standard form: `評価<U+FA19>T4` (神, old form) is saved as `評価<U+795E>T4`, and the standard form then gets 409. The old glyph shape (示-hen) can be lost from the heading.
  - **Valid kanji variant sequences are rejected.** A registered Ideographic Variation Sequence, such as `辻<U+E0100>`, also returns 400. If people need kanji variants (異体字) in names, the spec should decide how to handle them.
  - **Broken character data is replaced.** A lone surrogate (`\ud800`) is saved as U+FFFD. It stays visible, so this is harmless.

### デザイン評価（基準 7/10。Designer の変更なし、崩れなしを確認）
- **Header (anonymous, regular user, admin all the same):**

  | Width | Header height |
  |---|---|
  | 375px | 165px |
  | 768px | 109px |
  | 1024px | 109px |
  | 1280px | 61px |

  There is no horizontal scrolling at any width (`s3t4-{admin,anon,user}-{375,768,1024,1280}.png`).
- **Focus rings:**

  | Where | Ring colour | Contrast |
  |---|---|---|
  | Logo link on the black header | #53b1ff | 9.10:1 |
  | Theme button and search box on the black header | white | 21:1 |
  | 「内閣一覧へ戻る」 on the blue band | white | about 5.1:1 (`s3t4-light-back-focus.png`) |
  | 「編集」 on the light canvas | #0064b7 | 5.99:1 |
  | 「編集」 on the dark canvas | #53b1ff | 9.10:1 (`s3t4-dark-focus.png`) |

- **Design quality: 7/10** — clear hierarchy: weight-300 large heading, then reading, then a section heading; errors are signalled with a left border.
- **Originality: 7/10** — black header, blue section band and canvas are used consistently. 0 AI-slop signs.
- **Craft: 7/10** — the 768 header fits on one row. Deductions: the logo still breaks onto two lines at 320px, and the empty heading from finding 1 visibly hollows out the band.
- **Functionality: 7/10** — Tab order matches the visual order, every focus ring is above 3:1, and errors use `role=alert`.

### 改善提案（FAIL の理由にしない）
- Decide how to handle compatibility ideographs and Ideographic Variation Sequences (spec decision).
- Keep the logo on one line at 320px.
- Add a server-side length limit for the display name.
- Move the delete dialog's initial focus off 「削除する」.
- Make `ThemeToggle` prefer the cookie.
- Check the Origin header on write APIs.

### 再テスト対象（次回、最初に確認する項目）
1. **Must return 400, both API and screen:**
   - Invisible only: `<U+FFF9>`, `<U+FFFA>`, `<U+FFFB>`, `<U+FFFC>`.
   - Hidden character inside: `評価<U+FFF9>`.
   - Line/paragraph separators: `評価<U+2028>行`, `評価<U+2029>段`.
2. **Space variants:**
   - After creating `評価 空白`, both `評価<U+00A0>空白` and `評価  空白` (two spaces) must return 409 (or 400).
   - `安倍<U+3000>晋三`-style names with a full-width space must still return 201.
3. Recheck this attempt's passing values: the attempt-3 failures, the emoji list, 50 and 51 characters, and re-saving the seed data.
4. The 15 contract items and the regression checks.

### 評価に使った環境と残したもの
- **Throwaway DB:** `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s3-t4.db`
  - Accounts: `eval-admin4` (admin), `eval-user4`, `eval-ui4`, all `@s3t4.example.test`.
  - People: ids 178–211.
    - Empty-heading names: 195, 196, 208, 210.
    - Lookalike pairs: 197/198/199 and 191–194, 201, 202.
    - 178 was renamed to 「評価PUT改名T4」.
    - 211 is deleted.
    - All 87 seed people were re-saved with their existing values.
- **`local.db`:** read only. persons 87, user 0, id 2 is 「加藤勝信」, unchanged.
- **Servers:**
  - 3100 is stopped; one process did not exit on a normal kill and had to be force-killed.
  - dev 3000 is still running and returns 200.
- **Repository:**
  - `pnpm build` modified `apps/web/next-env.d.ts` (uncommitted). Restore it or let dev regenerate it.
  - Playwright MCP wrote logs to `.playwright-mcp/` (gitignored).
  - I changed no code or docs.
- **Screenshots and logs (scratchpad):**
  - `s3t4-fff9-empty-heading.png`、`s3t4-ui-fffb-created.png`、`s3t4-h1-{191,192,193,196,197,198,208}.png`
  - `s3t4-{admin,anon,user}-{375,768,1024,1280}.png`、`s3t4-light-back-focus.png`、`s3t4-dark-focus.png`、`s3t4-delete-dialog.png`
  - `tmp-ignore.png`（副産物）、`build-t4.log`、`server-3100.log`、`server-3100b.log`
  - いずれも `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/` にある。
- **Browser:** closed.

VERDICT: FAIL
RETURN_TO: generator

---

## 試行 5

VERDICT: PASS
RETURN_TO: none

## Evaluator verdict: pass (Sprint 3 / attempt 5)

Sprint 3 passes. The name-check failure from attempt 4 is fixed, and all 15 contract items, the Sprint 1–2 regression checks, the permission checks and the design check passed.

I ran almost everything on a production build at port 3100 with a throwaway DB. The Sprint 1–2 regression checks ran on dev 3000 and only read `local.db`.

The quality gates also pass when I run them myself:

| Check | Result |
|---|---|
| lint | 0 |
| typecheck | 0 |
| tests | db 37/37, web 14/14 |
| `pnpm build` | 0 |

One thing for you to decide, though it is not a reason to fail: a name written with a Cyrillic look-alike letter (`Јohn Smith`, starting with U+0408) is saved alongside `John Smith`, and the two headings look almost the same. Details are in "Look-alike names" below.

### Attempt-4 failure, retested first (API and screen)
**1. Hidden-character names** — pass.
- `<U+FFF9>`, `<U+FFFA>`, `<U+FFFB>`, `<U+FFFC>` alone: API returns 400 `nameRequired`; the screen shows 「氏名を入力してください」.
- `評価<U+FFF9>`, `評価<U+FFFC>`, `評価<U+2028>行`, `評価<U+2029>段`: API returns 400 `nameInvalidChar`; the screen shows 「氏名に使えない文字（…）が含まれています」. The URL stays on `/persons/new` and nothing is saved.
- PUT behaves the same: `評価PUT<U+FFF9>` returns 400.

**2. Spaces** — pass.
- `評価 空白` returns 201 (id 178).
- `評価<U+00A0>空白` returns 400 `nameInvalidChar`, on the API, the screen and PUT.
- `評価  空白` (two half-width spaces) returns 409 `nameDuplicate`. The screen shows 「同じ氏名の人物が既に登録されています」, and PUT also returns 409.
- `  評価 空白  ` returns 409, so leading and trailing spaces are trimmed.
- `評価<U+2003>空白` and `評価<U+202F>空白` return 400.
- `安倍<U+3000>晋三` returns 201. `<U+3000>安倍<U+3000>晋三<U+3000>` returns 409, because the outer full-width spaces are trimmed.
- On screen, `安倍<U+3000>晋三画面` and `評価 画面空白` both save and the heading matches.

**3. Cases that passed in attempts 3 and 4 still pass.**
- **Invisible character alone:** 400 `nameRequired` for `<U+3164>`, `<U+FFA0>`, `<U+2800>`, `<U+034F>`, `<U+FE0F>`, `<U+0301>`, `<U+115F>`, `<U+1160>`, `<U+200B>`. PUT of `<U+3164>` and `<U+0301>` also returns 400.
- **Look-alike duplicates:** 400 `nameInvalidChar` for `評価<U+FE0E>`, `評価<U+180B>`, `評価<U+E0100>`, `評価😀<U+E0061>`, `評価😀<U+200D>😀`, `評価😀<U+FE0F>`.
- **NFC (standard Unicode normalization) duplicates:**
  - `評価が` returns 201, then `評価か<U+3099>` returns 409 (on screen as well).
  - `評価き<U+3099>` returns 201, then `評価ぎ` returns 409.
  - PUT of `評価か<U+3099>` returns 409.
- **Other hidden or control characters:** `<U+202E>`, `<U+00AD>`, NUL, BEL, `評価<U+000A>x` and `<U+0085>` all return 400.
  - A trailing newline (`評価<U+000A>`) returns 201, but it is stored as `評価` after trimming. Nothing hidden gets saved.

**4. Normal names return 201.**
- Emoji: `👩🏽<U+200D>💻`, the family emoji, the England flag, 🏳️‍🌈, 🏴‍☠️, 👁️‍🗨️, 🇯🇵.
- Text: `John Smith`, `O'Brien`, `山田・太郎`, `Jean-Luc`, `評価髙橋﨑山齋藤邊渡ヶ々ーカタカナがぎぐ`, and a 50-character name.
- A 51-character name returns 400 `nameTooLong` (on screen: 「氏名は50文字以内にしてください」).

**5. `%`, `_`, `\`** — as designed.
- `評価%_\` returns 400 `nameInvalidChar` (intended).
- Searching `/api/search?q=` with `%`, `_`, `\`, `%%`, `評価%` or `a_b` returns 200 with 0 hits each time. They are not treated as wildcards, so the search does not return everything.

**6. Memo** — pass.
- Line breaks and tabs return 201, and an emoji with a joiner (`メモ👩🏽<U+200D>💻`) returns 201.
- With the character in the middle (`メ?モ`), 400 `memoInvalidChar` for: `<U+2028>`, `<U+2029>`, `<U+FFF9>`, `<U+3164>`, `<U+00AD>`, NUL, `<U+E0100>`. Also `メモ<U+200B>`, `メモ<U+3164>`, `メモ<U+FFFC>`.
- On screen, `メ<U+200B>モ` shows 「メモに使えない制御文字・見えない文字が含まれています」.
- `メモ<U+2028>` at the end returns 201, but it is stored as `メモ` (trimmed), so nothing hidden is saved.

**7. PUT and seed data** — pass.
- I re-saved all 87 seed people with PUT using their current values: 87/87 returned 200.
- For all 87, the person page and the edit page loaded with 200.

### Search for new gaps in the allowlist
I looked for allowed characters that draw nothing:
- **Scan:** in Chrome, I drew every allowed code point (letters, numbers and combining marks that are not default-ignorable) and measured the ink. The CJK ranges, Hangul syllables and U+20000 and above were skipped.
- **Combining marks:** 0 marks after `価` drew nothing.
- **Letters:** 11 letters drew nothing in the canvas test.
  - In the real heading, ゕ, ゖ and ゟ are visible.
  - U+FAD5 (which NFC turns into U+25249) and U+16910 showed as blank space. This test machine has no font for them; on a normal system they would be drawn by a font or shown as a "missing character" box. I treat this as the test environment, not a defect.
- **`評価<U+16FE4>`** (a Khitan filler, which is a combining mark but not default-ignorable) returns 201. It shows as a "missing character" box, so it is visible (`s3t5-h1-202.png`).
- **Keycaps:** `1<U+FE0F><U+20E3>` and `1<U+20E3>` both return 201, but they look clearly different: an emoji keycap versus a 1 plus a box (`s3t5-h1-kc1.png`, `s3t5-h1-kc2.png`).
- **Look-alike names, reported as a note only, not a failure:**
  - `Јohn Smith` (Cyrillic Ј, U+0408) returns 201 alongside `John Smith`, and the two headings look almost the same (`s3t5-h1-id190.png`, `s3t5-h1-id203.png`).
  - Also saved as separate names: `評価Ⅰ` (Roman numeral) next to `評価I`, and `O’Brien` next to `O'Brien`.
  - **Why this is not a failure:** `docs/spec.md` has no rule against duplicate or look-alike names. Japanese itself has unavoidable look-alikes between allowed letters (カ/力, エ/工, ロ/口, ー/一), which is the same kind of question as the excluded half-width/full-width and compatibility-kanji cases.
  - **Decision needed:** whether to restrict mixed scripts using Unicode's confusable-character rules (UTS #39). That is a spec question for the planner and the user.

### Sprint contract (3100, throwaway DB)
- [x] **1. Logged out, the header shows 「ログイン」** — pass. Checked on `/`, `/persons/2` and `/cabinets/6`.
- [x] **2. Registering with an 8-character password logs you in** — pass. It moves to `/`, and the header shows 「評価UI一般T5 | ログアウト」.
- [x] **3. A 7-character password is rejected** — pass. 「パスワードは8文字以上にしてください」 is shown, the page stays on `/register`, and the header still shows 「ログイン」.
- [x] **4. Logging out** — pass. The header goes back to 「ログイン | 新規登録」.
- [x] **5. Admin grant command, registered address** — pass. The command is documented in `docs/project.md`. It printed 「eval-admin5@s3t5.example.test を管理者にしました」 and exited with code 0.
- [x] **6. Admin header** — pass. After logging in, the header shows 「人物を追加」.
- [x] **7. Admin grant command, unregistered address** — pass. It printed 「該当するアカウントがありません」 and exited with code 2. With no argument it exits with code 1.
- [x] **8. Logged-out and regular users see no edit controls** — pass.
  - In both states, 「編集」, 「削除」 and 「人物を追加」 appear 0 times.
  - Logged out, `/persons/new` redirects to `/login`.
  - A regular user opening `/persons/new` or `/persons/2/edit` sees 「この操作は管理者だけができます」.
- [x] **9. Logged-out API calls** — pass. POST, PUT and DELETE all return 401.
- [x] **10. Regular-user API calls** — pass.
  - POST, PUT and DELETE all return 403, and searching for the name returns 0 hits.
  - Sending `"role":"admin"` at sign-up still gives `role: user`.
- [x] **11. Adding a person** — pass. Saving 「評価花子T5」 moves to `/persons/209`, and the heading matches.
- [x] **12. A katakana reading is rejected** — pass. 「よみがなはひらがなで入力してください」 is shown, the page does not move, and the search finds nothing.
- [x] **13. Renaming shows everywhere** — pass.
  - `/persons/2` renamed to 「加藤勝信評価改名T5」 shows in its heading and in the `/cabinets/7` member list.
  - I changed it back afterwards.
- [x] **14. Data survives a restart** — pass.
  - After stopping and restarting the 3100 production server, person 209, the renamed person 2, and the admin's 「人物を追加」 were all still there.
  - I did not restart the dev server on 3000, because I was told not to stop it. Storage is the same database file either way.
- [x] **15. Deleting a person** — pass.
  - The dialog is a true modal (`:modal`) with the text 「評価花子T5を削除します。この操作は取り消せません。」.
  - 「削除する」 returns to `/`.
  - Searching 「評価花子」 shows 「該当する結果はありません」, and `/persons/209` returns 404.
  - Deleting person 2, who has career records, returns 409 `hasCareers`.

### Regression (dev 3000, `local.db` read only)
- **Cabinet list:** 9 rows. 「現在」 appears only on row 1 (第2次高市内閣).
- **Suga cabinet dates:** 2020年9月16日 / 2021年10月4日.
- **`/cabinets/6`:** 19 rows. Row 1 is 内閣総理大臣 (石破茂), 林芳正 is included, and every row has exactly one source link.
- **`/persons/2`:** 「加藤勝信」, with 5 career rows.
- **Search:**
  - 「かとうかつ」 suggests 加藤勝信.
  - 「岸田」 then ↑ and Enter goes to `/cabinets/2`.
  - 「zzzzz」 shows 「該当する結果はありません」.
- **Not found:** `/cabinets/99999` and `/persons/abc` return 404 with their own headings.

### Edge cases and health
- **Console:**
  - Production (3100) form pages, person pages and the delete flow: no errors, no warnings and no page exceptions.
  - The only errors are expected resource-load messages: the 409 on a duplicate name, and the 404 on the not-found pages on 3000.
- **Emoji regex (`RGI_Emoji`):** it compiles in HeadlessChrome 157 on both 3100 and 3000.
- **Server:** no 5xx responses.
- **Secrets:** none shown on screen or in responses.
- **Accessibility:**
  - On an error, the field gets `aria-invalid=true` and `aria-describedby=name-error`, the message uses `role=alert`, and focus moves to the field with the error.
  - Tab order is: logo, theme switch, 「人物を追加」, 「ログアウト」, search, 「内閣一覧へ戻る」, 「編集」, 「削除」, then the career links.

### Design check (threshold 7/10; Designer made no changes, and I checked for breakage myself)
**Header height, admin logged in** (light and dark the same):

| Width | Header height |
|---|---|
| 375px | 165px |
| 768px | 109px |
| 1280px | 61px |

There is no horizontal scrolling at any width (`scrollWidth` equals the viewport).

**Focus rings** (all well above 3:1):

| Where | Ring colour | Contrast |
|---|---|---|
| Logo, 「人物を追加」, 「ログアウト」 on the black header | #53b1ff | 9.1:1 |
| Theme button and search box on the black header | white | 21:1 |
| 「内閣一覧へ戻る」 on the blue band (#0070d1, measured from pixels) | white | about 4.95:1 |
| 「編集」 and 「削除」 on the light canvas | #0064b7 | 5.99:1 |
| Same, on the dark canvas | #53b1ff | 9.1:1 |

- **Design quality: 7/10.** The page heading 「人物を追加」 is a large light-weight title above a divider, with clear steps from field labels to the 「必須」 tag to the hint text. Errors use a left border and a red message (`s3t5-dark-1280-form-err.png`).
- **Originality: 7/10.** The black header, blue band and white or black canvas are applied consistently, and buttons are pill-shaped. 0 AI-slop signs.
- **Craft: 7/10.** At 768px the header fits on one row plus the search row. At 375px a long error message wraps cleanly inside the left border (`s3t5-light-375-form-err-fresh.png`).
- **Functionality: 7/10.** Error state is announced by `aria-invalid` and `role=alert`, focus moves to the field with the error, and every focus ring is above 3:1.

### Suggestions (not reasons to fail)
- Decide whether to restrict mixed scripts in names (UTS #39 confusable rules), as described above.
- The `nameInvalidChar` message says 「（制御文字・改行・見えない文字など）」, but `%` and `&` are now rejected too. Wording such as 「氏名に使えない文字が含まれています（使える記号: ・ - ' . など）」 would be clearer.
- Already deferred items (320px logo wrap, display-name length limit on the server, delete dialog's initial focus, `ThemeToggle` preferring the cookie, Origin check on write APIs, handling of kanji variant sequences and compatibility kanji, and foreign names containing `&` or `,`) remain open.

### Environment and leftovers
- **Throwaway DB:** `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/eval-s3-t5.db`
  - Accounts, all `@s3t5.example.test`: `eval-admin5` (admin), `eval-user5`, `eval-ui5`. `eval-seven5` was not created.
  - People: ids 178–208. Person 209 was created and then deleted. All 87 seed people were re-saved with their existing values, and person 2 was restored to 「加藤勝信」.
- **`local.db`:** read only. Still persons 87, user 0, id 2 is 「加藤勝信」.
- **Servers:** 3100 is stopped and returns no response. Dev 3000 is still running (200).
- **Repository:** `pnpm build` changed `apps/web/next-env.d.ts` (`.next/dev/types` became `.next/types`; uncommitted). Restore it, or let dev regenerate it. I changed no code or docs.
- **Screenshots and logs:** all in `/tmp/claude-0/-home-user-Japan-Politics/65114978-a6cf-52de-8de6-5cf52771b0d8/scratchpad/` (`s3t5-*.png`, `build-t5.log`, `server-3100-t5*.log`).
- **Browser:** closed.

VERDICT: PASS
RETURN_TO: none
