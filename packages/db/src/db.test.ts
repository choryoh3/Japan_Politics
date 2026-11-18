import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "./client.ts";
import { validatePersonInput } from "./person-input.ts";
import { createPerson, deletePerson, grantAdmin, updatePerson } from "./person-write.ts";
import { user } from "./schema.ts";
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

  it("生年月日は実在する日付だけで、空欄は null になる", () => {
    expect(validatePersonInput({ name: "A", kana: "あ", birthDate: "2001-02-29" }).ok).toBe(false);
    const ok = validatePersonInput({ name: "A", kana: "あ", birthDate: "", memo: "" });
    expect(ok).toEqual({
      ok: true,
      value: { name: "A", kana: "あ", birthDate: null, memo: null },
    });
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
