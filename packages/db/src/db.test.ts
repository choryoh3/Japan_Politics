import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "./client.ts";
import { validatePersonInput } from "./person-input.ts";
import { createPerson, deletePerson, grantAdmin, updatePerson } from "./person-write.ts";
import { persons, user } from "./schema.ts";
import { runMigrations } from "./migrate.ts";
import { getCabinetDetail, getPersonProfile, listCabinets, searchSuggestions } from "./queries.ts";
import { seedInitialData } from "./seed.ts";

let dir: string;
let db: Db;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "jp-db-"));
  db = createDb(`file:${join(dir, "test.db")}`);
  await runMigrations(db);
  await seedInitialData(db);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("初期データの投入", () => {
  it("2 回続けて投入しても内閣・閣僚人事の件数が増えない", async () => {
    const before = await listCabinets(db);
    const detailBefore = await getCabinetDetail(db, before[0]!.id);
    await seedInitialData(db);
    const after = await listCabinets(db);
    const detailAfter = await getCabinetDetail(db, after[0]!.id);
    expect(after.length).toBe(before.length);
    expect(detailAfter?.roster.length).toBe(detailBefore?.roster.length);
  });
});

describe("内閣一覧", () => {
  it("8 件以上あり、発足日の新しい順で、菅内閣が最後", async () => {
    const list = await listCabinets(db);
    expect(list.length).toBeGreaterThanOrEqual(8);
    const dates = list.map((c) => c.startDate);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(list.at(-1)?.name).toBe("菅内閣");
  });

  it("終了日なし（現在）の内閣がちょうど 1 件で、先頭にある", async () => {
    const list = await listCabinets(db);
    const current = list.filter((c) => c.endDate === null);
    expect(current).toHaveLength(1);
    expect(list[0]?.endDate).toBeNull();
  });

  it("照合用の 3 つの内閣名が含まれ、各行に首相名がある", async () => {
    const list = await listCabinets(db);
    const names = list.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["菅内閣", "第1次岸田内閣", "第1次石破内閣"]));
    expect(list.every((c) => c.primeMinisterName)).toBe(true);
  });
});

describe("内閣詳細", () => {
  it("菅内閣の発足日・終了日が契約どおり", async () => {
    const list = await listCabinets(db);
    const suga = list.find((c) => c.name === "菅内閣");
    const detail = await getCabinetDetail(db, suga!.id);
    expect(detail?.startDate).toBe("2020-09-16");
    expect(detail?.endDate).toBe("2021-10-04");
  });

  it("第1次石破内閣は 15 行以上で、1 行目が首相、2 行目が官房長官、林芳正が官房長官", async () => {
    const list = await listCabinets(db);
    const ishiba = list.find((c) => c.name === "第1次石破内閣");
    const detail = await getCabinetDetail(db, ishiba!.id);
    expect(detail!.roster.length).toBeGreaterThanOrEqual(15);
    expect(detail!.roster[0]?.postName).toBe("内閣総理大臣");
    expect(detail!.roster[1]?.postName).toBe("内閣官房長官");
    expect(
      detail!.roster.some((r) => r.postName === "内閣官房長官" && r.personName === "林芳正"),
    ).toBe(true);
  });

  it("全ての閣僚人事の出典 URL が首相官邸のページ", async () => {
    for (const c of await listCabinets(db)) {
      const detail = await getCabinetDetail(db, c.id);
      for (const row of detail!.roster) {
        expect(row.sourceUrl.startsWith("https://www.kantei.go.jp/")).toBe(true);
      }
    }
  });

  it("存在しない ID は null", async () => {
    expect(await getCabinetDetail(db, 999999)).toBeNull();
  });
});

describe("人物の経歴", () => {
  it("加藤勝信の経歴に菅内閣の官房長官と第1次石破内閣の財務大臣があり、就任日の新しい順", async () => {
    const found = await searchSuggestions(db, "加藤勝信");
    const profile = await getPersonProfile(db, found.persons[0]!.id);
    expect(profile?.name).toBe("加藤勝信");
    expect(profile?.kana).toMatch(/^[ぁ-ゖー]+$/);
    const pairs = profile!.careers.map((c) => `${c.cabinetName}/${c.postName}`);
    expect(pairs).toEqual(
      expect.arrayContaining(["菅内閣/内閣官房長官", "第1次石破内閣/財務大臣"]),
    );
    const starts = profile!.careers.map((c) => c.startDate);
    expect([...starts].sort().reverse()).toEqual(starts);
    expect(profile!.careers.every((c) => c.sourceUrl.startsWith("http"))).toBe(true);
  });

  it("存在しない人物は null", async () => {
    expect(await getPersonProfile(db, 999999)).toBeNull();
  });
});

describe("横断検索", () => {
  it("「石破」で人物の石破茂が見つかる", async () => {
    const r = await searchSuggestions(db, "石破");
    expect(r.persons.map((p) => p.name)).toContain("石破茂");
  });
  it("よみがな「かとうかつ」で加藤勝信が見つかる。カタカナでも見つかる", async () => {
    expect((await searchSuggestions(db, "かとうかつ")).persons.map((p) => p.name)).toContain(
      "加藤勝信",
    );
    expect((await searchSuggestions(db, "カトウカツ")).persons.map((p) => p.name)).toContain(
      "加藤勝信",
    );
  });
  it("「岸田」で内閣の第1次岸田内閣が見つかる", async () => {
    const r = await searchSuggestions(db, "岸田");
    expect(r.cabinets.map((c) => c.name)).toContain("第1次岸田内閣");
  });
  it("該当なし・空白・LIKE の特殊文字は安全に空で返る", async () => {
    for (const q of ["zzzzz", "   ", "%", "_"]) {
      const r = await searchSuggestions(db, q);
      expect(r.persons).toHaveLength(0);
      expect(r.cabinets).toHaveLength(0);
    }
  });
});

describe("人物の入力検証", () => {
  it("氏名もよみがなも空だとエラーコードが返る", () => {
    const result = validatePersonInput({ name: " ", kana: "" });
    expect(result).toEqual({ ok: false, errors: { name: "nameRequired", kana: "kanaRequired" } });
  });

  it("よみがなはひらがなだけ（カタカナ・漢字・英字は不可、長音符は可）", () => {
    for (const kana of ["カタカナ", "山田", "abc", "ひらカナ"]) {
      const result = validatePersonInput({ name: "A", kana });
      expect(result.ok).toBe(false);
    }
    expect(validatePersonInput({ name: "A", kana: "らーめん" }).ok).toBe(true);
  });

  it("氏名とよみがなは NUL・BEL・改行などの制御文字を拒否する", () => {
    for (const bad of ["\u0000評価", "評価\u0000別物", "評価\u0007", "評\n価", "評\t価"]) {
      expect(validatePersonInput({ name: bad, kana: "あ" })).toEqual({
        ok: false,
        errors: { name: "nameInvalidChar" },
      });
    }
    for (const bad of ["あ\u0000", "\u0000あ", "あ\u0007", "あ\nあ"]) {
      expect(validatePersonInput({ name: "A", kana: bad })).toEqual({
        ok: false,
        errors: { kana: "kanaInvalidChar" },
      });
    }
  });

  it("氏名が見えない文字だけなら nameRequired で拒否する", () => {
    for (const bad of ["\u200B", "\u200B\u200C\u200D\u2060", "\u200D", " \u200B "]) {
      expect(validatePersonInput({ name: bad, kana: "あ" })).toEqual({
        ok: false,
        errors: { name: "nameRequired" },
      });
    }
  });

  it("氏名に混ざった見えない文字（U+202E・U+00AD・ゼロ幅）は拒否する", () => {
    for (const bad of [
      "\u202E評価逆",
      "評価\u00AD軟",
      "評価\u200B幅なし",
      "評価\u200D幅なし",
      "評\uFEFF価",
    ]) {
      expect(validatePersonInput({ name: bad, kana: "あ" })).toEqual({
        ok: false,
        errors: { name: "nameInvalidChar" },
      });
    }
  });

  it("絵文字の結合（ZWJ・旗のタグ）と記号は氏名として許す", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
    const england = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
    for (const ok of [family, england, "\u{1F600}", "あ".repeat(50)]) {
      expect(validatePersonInput({ name: ok, kana: "あ" }).ok).toBe(true);
    }
  });

  it("見えない文字だけ・見た目が同じ重複を作れる氏名は拒否する（標準の性質で網羅）", () => {
    const onlyInvisible = [
      "\u3164",
      "\uFFA0",
      "\u2800",
      "\u034F",
      "\uFE0F",
      "\u0301",
      "\u3164\u3164",
    ];
    for (const bad of onlyInvisible) {
      expect(validatePersonInput({ name: bad, kana: "あ" }).ok).toBe(false);
    }
    const lookalike = [
      "評価\uFE0E",
      "評価\u180B",
      "評価\u{E0100}",
      "評価😀\u{E0061}",
      "評価😀\u200D😀",
      "評価😀\uFE0F",
    ];
    for (const bad of lookalike) {
      expect(validatePersonInput({ name: bad, kana: "あ" })).toEqual({
        ok: false,
        errors: { name: "nameInvalidChar" },
      });
    }
  });

  it("正当な絵文字（肌の色・家族・旗・虹の旗・海賊旗など）は許し、51文字は拒否する", () => {
    const valid = [
      "👩🏽\u200D💻",
      "👨\u200D👩\u200D👧",
      "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
      "🏳\uFE0F\u200D🌈",
      "🏴\u200D☠\uFE0F",
      "👁\uFE0F\u200D🗨\uFE0F",
      "🇯🇵",
      "あ".repeat(50),
    ];
    for (const ok of valid) {
      expect(validatePersonInput({ name: ok, kana: "あ" }).ok).toBe(true);
    }
    expect(validatePersonInput({ name: "あ".repeat(51), kana: "あ" })).toEqual({
      ok: false,
      errors: { name: "nameTooLong" },
    });
  });

  it("氏名は NFC に正規化され、見た目が同じ濁点の別表現は同じ文字列になる", () => {
    const composed = validatePersonInput({ name: "評価が", kana: "あ" });
    const decomposed = validatePersonInput({ name: "評価か\u3099", kana: "あ" });
    expect(composed.ok && decomposed.ok).toBe(true);
    if (composed.ok && decomposed.ok) {
      expect(decomposed.value.name).toBe(composed.value.name);
    }
  });

  it("メモの見えない文字は拒否する", () => {
    for (const bad of ["\u200B", "メモ\u202E", "メモ\u00AD", "メモ\u3164", "メモ😀\u200D😀"]) {
      expect(validatePersonInput({ name: "A", kana: "あ", memo: bad })).toEqual({
        ok: false,
        errors: { memo: "memoInvalidChar" },
      });
    }
  });

  it("メモは改行とタブを許し、NUL・BEL などは拒否する", () => {
    expect(validatePersonInput({ name: "A", kana: "あ", memo: "一行目\n二行目\t字下げ" }).ok).toBe(
      true,
    );
    for (const bad of ["a\u0000b", "a\u0007"]) {
      expect(validatePersonInput({ name: "A", kana: "あ", memo: bad })).toEqual({
        ok: false,
        errors: { memo: "memoInvalidChar" },
      });
    }
  });

  it("生年月日は実在する日付だけで、空欄は null になる", () => {
    expect(validatePersonInput({ name: "A", kana: "あ", birthDate: "2001-02-29" }).ok).toBe(false);
    const ok = validatePersonInput({ name: "A", kana: "あ", birthDate: "", memo: "" });
    expect(ok).toEqual({
      ok: true,
      value: { name: "A", kana: "あ", birthDate: null, memo: null },
    });
  });
});

describe("氏名の許可リスト方式の検証", () => {
  const check = (name: string) => validatePersonInput({ name, kana: "あ" });
  const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
  const england = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";

  it("見える文字が無い氏名は nameRequired", () => {
    const bad = [
      "\uFFF9",
      "\uFFFA",
      "\uFFFB",
      "\uFFFC",
      "\u3164",
      "\u2800",
      "\u034F",
      "\uFE0F",
      "\u0301",
      "\u115F",
      "\u1160",
      "・",
      "-",
      "・-.",
      "   ",
      "\u3000\u3000",
    ];
    for (const name of bad) {
      expect(check(name)).toEqual({ ok: false, errors: { name: "nameRequired" } });
    }
  });

  it("許可外の文字が混ざった氏名は nameInvalidChar", () => {
    const bad = [
      "評価\uFFF9",
      "評価\uFFFC",
      "評価\u2028行",
      "評価\u2029段",
      "評価\u00A0空白",
      "評価\u2003空白",
      "評価\u202F空白",
      "評価\uFE0E",
      "評価\u180B",
      "評価\u{E0100}",
      "評価😀\u{E0061}",
      "評価😀\u200D😀",
      "評価😀\uFE0F",
      "\u0301評価",
      "評価 \u0301",
      "評価・\u0301",
      "評価😀\u0301",
      "評価\u3099",
      "評価★",
      "評価\u2800",
      "評価\u3164",
      "\u0000評価",
      "評価\u0007",
      "評\n価",
      "評\t価",
      "評\u0085価",
      "評\u200B価",
      "\u202E評価",
      "評価\u00AD軟",
      "評価\u200B",
      "評価\u200D",
      "評\uFEFF価",
    ];
    for (const name of bad) {
      expect(check(name)).toEqual({ ok: false, errors: { name: "nameInvalidChar" } });
    }
  });

  it("許可する氏名は ok で、値は変わらない", () => {
    const ok = [
      "安倍\u3000晋三",
      "John Smith",
      "O'Brien",
      "O\u2019Brien",
      "山田・太郎",
      "Jean-Luc",
      "J. Smith",
      "評価髙橋﨑山齋藤邊渡ヶ々ーカタカナがぎぐ",
      "👩🏽\u200D💻",
      family,
      england,
      "🏳\uFE0F\u200D🌈",
      "🏴\u200D☠\uFE0F",
      "👁\uFE0F\u200D🗨\uFE0F",
      "🇯🇵",
      "あ".repeat(50),
      "e\u0301",
      "A3",
    ];
    for (const name of ok) {
      const result = check(name);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe(name.normalize("NFC"));
    }
    // 許可リスト外の記号（% _ \）は拒否される（SQL の LIKE 記号の扱いは検索側のテストで確認）
    expect(check("評価%_\\")).toEqual({ ok: false, errors: { name: "nameInvalidChar" } });
    expect(check("あ".repeat(51))).toEqual({ ok: false, errors: { name: "nameTooLong" } });
  });

  it("半角スペースの連続は1つに畳まれ、前後の空白は取り除かれる", () => {
    const one = check("評価 空白");
    const two = check("評価  空白");
    expect(one.ok && two.ok).toBe(true);
    if (one.ok && two.ok) expect(two.value.name).toBe(one.value.name);
    const trimmed = check("\u3000 評価 \u3000");
    expect(trimmed.ok && trimmed.value.name).toBe("評価");
  });

  it("NFC の重複は同じ文字列になる", () => {
    const a = check("評価が");
    const b = check("評価か\u3099");
    const c = check("評価き\u3099");
    const d = check("評価ぎ");
    expect(a.ok && b.ok && c.ok && d.ok).toBe(true);
    if (a.ok && b.ok && c.ok && d.ok) {
      expect(b.value.name).toBe(a.value.name);
      expect(c.value.name).toBe(d.value.name);
    }
  });

  it("メモは U+FFFC・U+2028・U+2029・U+2800・Cf を拒否し、改行とタブ・絵文字は許す", () => {
    for (const bad of ["a\uFFFC", "a\u2028b", "a\u2029b", "a\u2800", "a\uFFF9", "a\u200B"]) {
      expect(validatePersonInput({ name: "A", kana: "あ", memo: bad })).toEqual({
        ok: false,
        errors: { memo: "memoInvalidChar" },
      });
    }
    const memo = `一行目\n二行目\t${family}${england}`;
    expect(validatePersonInput({ name: "A", kana: "あ", memo }).ok).toBe(true);
  });

  it("seed の全員の氏名が検証 ok で、検証後も値が変わらない", async () => {
    const rows = await db.select({ name: persons.name, kana: persons.kana }).from(persons);
    expect(rows.length).toBeGreaterThanOrEqual(87);
    for (const row of rows) {
      const result = validatePersonInput({ name: row.name, kana: row.kana });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe(row.name);
    }
  });
});

describe("人物の追加・修正・削除と管理者付与", () => {
  it("追加した人物を修正でき、同じ氏名は重複として拒否される", async () => {
    const created = await createPerson(db, {
      name: "試験一郎",
      kana: "しけんいちろう",
      birthDate: "1980-01-02",
      memo: null,
    });
    expect(created.ok).toBe(true);
    const id = (created as { id: number }).id;
    const dup = await createPerson(db, {
      name: "試験一郎",
      kana: "あ",
      birthDate: null,
      memo: null,
    });
    expect(dup).toEqual({ ok: false, reason: "duplicate" });
    await updatePerson(db, id, {
      name: "試験二郎",
      kana: "しけんじろう",
      birthDate: null,
      memo: "メモ",
    });
    const profile = await getPersonProfile(db, id);
    expect(profile).toMatchObject({ name: "試験二郎", birthDate: null, memo: "メモ" });
    expect(
      await updatePerson(db, 999999, { name: "x", kana: "あ", birthDate: null, memo: null }),
    ).toEqual({ ok: false, reason: "notFound" });
  });

  it("NFC で同じになる氏名は検証後に重複として拒否される", async () => {
    const first = validatePersonInput({ name: "正規化が", kana: "あ" });
    const second = validatePersonInput({ name: "正規化か\u3099", kana: "あ" });
    if (!first.ok || !second.ok) throw new Error("検証に失敗した");
    expect((await createPerson(db, first.value)).ok).toBe(true);
    expect(await createPerson(db, second.value)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("経歴のない人物は削除でき、経歴のある人物は削除できない", async () => {
    const created = await createPerson(db, {
      name: "削除対象",
      kana: "さくじょ",
      birthDate: null,
      memo: null,
    });
    const id = (created as { id: number }).id;
    expect(await deletePerson(db, id)).toEqual({ ok: true, id });
    expect(await getPersonProfile(db, id)).toBeNull();
    expect(await deletePerson(db, id)).toEqual({ ok: false, reason: "notFound" });
    const withCareer = (await searchSuggestions(db, "石破茂")).persons[0]!;
    expect(await deletePerson(db, withCareer.id)).toEqual({ ok: false, reason: "hasCareers" });
    expect(await getPersonProfile(db, withCareer.id)).not.toBeNull();
  });

  it("管理者付与: 登録済みメールは role が admin になり、未登録は noAccount", async () => {
    const now = new Date();
    await db
      .insert(user)
      .values({ id: "u1", name: "A", email: "a@example.com", createdAt: now, updatedAt: now });
    expect(await grantAdmin(db, "A@Example.com")).toEqual({ ok: true });
    const [row] = await db.select().from(user).where(eq(user.id, "u1"));
    expect(row?.role).toBe("admin");
    expect(await grantAdmin(db, "none@example.com")).toEqual({ ok: false, reason: "noAccount" });
  });
});
