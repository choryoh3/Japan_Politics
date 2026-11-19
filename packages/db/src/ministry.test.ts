import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.ts";
import { validateAppointmentInput, type AppointmentInput } from "./cabinet-input.ts";
import {
  CABINET_POSTS,
  MINISTRIES,
  isCabinetPost,
  isSoloPost,
  postCategory,
  postNamesForMinistry,
} from "./cabinet-posts.ts";
import {
  createAppointment,
  createCabinet,
  deleteAppointment,
  updateAppointment,
} from "./cabinet-write.ts";
import { runMigrations } from "./migrate.ts";
import { createPerson } from "./person-write.ts";
import { getCabinetDetail, getMinistryPage, listCabinets, listMinistries } from "./queries.ts";
import { seedInitialData } from "./seed.ts";
import { cabinetAppointments } from "./schema.ts";

let dir: string;
let db: Db;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "jp-ministry-"));
  db = createDb(`file:${join(dir, "test.db")}`);
  await runMigrations(db);
  await seedInitialData(db);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** 検証を通した人事の入力を作る（通らなければテストを失敗させる）。 */
function valid(overrides: Record<string, unknown>): AppointmentInput {
  const result = validateAppointmentInput({ postName: "財務副大臣", personId: 1, ...overrides });
  if (!result.ok) throw new Error(`入力が不正: ${JSON.stringify(result.errors)}`);
  return result.value;
}

/** テスト用の人物を登録して ID を返す。 */
async function newPerson(name: string): Promise<number> {
  const result = await createPerson(db, { name, kana: "てすと", birthDate: null, memo: null });
  if (!result.ok) throw new Error("人物を登録できませんでした");
  return result.id;
}

/** テスト用の内閣を登録して ID を返す。 */
async function newCabinet(name: string, startDate: string, endDate: string | null = null) {
  const result = await createCabinet(db, { name, startDate, endDate });
  if (!result.ok) throw new Error("内閣を登録できませんでした");
  return result.id;
}

describe("役職マスタ", () => {
  it("内閣官房副長官・各府省の副大臣・大臣政務官が選べ、区分と担当府省が対応する", () => {
    expect(isCabinetPost("内閣官房副長官")).toBe(true);
    expect(isCabinetPost("財務副大臣")).toBe(true);
    expect(isCabinetPost("財務大臣政務官")).toBe(true);
    expect(isCabinetPost("デジタル副大臣")).toBe(true);
    expect(isCabinetPost("復興大臣政務官")).toBe(true);
    expect(isCabinetPost("内閣府副大臣")).toBe(true);
    expect(isCabinetPost("財務省副大臣")).toBe(false);
    expect(postCategory("財務大臣")).toBe("minister");
    expect(postCategory("内閣官房副長官")).toBe("deputyChiefSecretary");
    expect(postCategory("財務副大臣")).toBe("viceMinister");
    expect(postCategory("財務大臣政務官")).toBe("parliamentaryVice");
    // 一覧にない役職は閣僚として扱う（既存の人事を壊さない）
    expect(postCategory("存在しない役職")).toBe("minister");
    expect(postNamesForMinistry("財務省", "minister")).toEqual(["財務大臣"]);
    expect(postNamesForMinistry("財務省", "viceMinister")).toEqual(["財務副大臣"]);
    expect(postNamesForMinistry("内閣府", "minister")).toContain("経済再生担当大臣");
  });

  it("役職名は重複せず、重なりを許すのは特命担当・副長官・副大臣・大臣政務官だけ", () => {
    const names = CABINET_POSTS.map((post) => post.name);
    expect(new Set(names).size).toBe(names.length);
    expect(isSoloPost("財務大臣")).toBe(true);
    expect(isSoloPost("内閣総理大臣")).toBe(true);
    expect(isSoloPost("内閣官房長官")).toBe(true);
    expect(isSoloPost("内閣官房副長官")).toBe(false);
    expect(isSoloPost("財務副大臣")).toBe(false);
    expect(isSoloPost("財務大臣政務官")).toBe(false);
    expect(isSoloPost("行政改革担当大臣")).toBe(false);
  });

  it("画面と API が通す検証関数は、新しい役職を受け付け、表記ゆれを拒否する", () => {
    expect(validateAppointmentInput({ postName: "財務副大臣", personId: 1 }).ok).toBe(true);
    const bad = validateAppointmentInput({ postName: "財務副大臣 ", personId: 1 });
    expect(bad.ok).toBe(true); // 前後の空白は取り除く
    const result = validateAppointmentInput({ postName: "ざいむふくだいじん", personId: 1 });
    expect(result.ok).toBe(false);
  });
});

describe("府省の初期データ", () => {
  it("14 件で、財務省・外務省・防衛省を含み、2 回投入しても増えない", async () => {
    const before = await listMinistries(db);
    expect(before.map((m) => m.name)).toEqual(MINISTRIES.map((m) => m.name));
    expect(before).toHaveLength(14);
    expect(before.map((m) => m.name)).toEqual(
      expect.arrayContaining(["財務省", "外務省", "防衛省"]),
    );
    await seedInitialData(db);
    const after = await listMinistries(db);
    expect(after).toEqual(before);
  });

  it("2 回投入しても詳細人事（内閣官房副長官）の件数が増えない。最新の内閣に 3 名、菅内閣には副大臣がない", async () => {
    const [latest] = await listCabinets(db);
    const first = await getCabinetDetail(db, latest!.id);
    const countOf = (detail: typeof first, post: string) =>
      detail!.roster.filter((row) => row.postName === post).length;
    expect(countOf(first, "内閣官房副長官")).toBe(3);
    await seedInitialData(db);
    const second = await getCabinetDetail(db, latest!.id);
    expect(second!.roster.length).toBe(first!.roster.length);
    const cabinets = await listCabinets(db);
    const suga = cabinets.find((c) => c.name === "菅内閣")!;
    const sugaDetail = await getCabinetDetail(db, suga.id);
    expect(sugaDetail!.roster.some((row) => postCategory(row.postName) === "viceMinister")).toBe(
      false,
    );
  });

  it("詳細人事の出典 URL は官邸の URL の形で、出典メモに未確認と書かれている", async () => {
    const [latest] = await listCabinets(db);
    const detail = await getCabinetDetail(db, latest!.id);
    const deputies = detail!.roster.filter((row) => row.postName === "内閣官房副長官");
    for (const row of deputies) {
      expect(row.sourceUrl.startsWith("https://www.kantei.go.jp/")).toBe(true);
      expect(row.sourceNote).toContain("未確認");
    }
  });
});

describe("詳細人事の追加・重なり・修正・削除", () => {
  it("同じ内閣・同じ期間に財務副大臣を 2 人登録でき、同じ人物の重複登録は拒否される", async () => {
    const cabinetId = await newCabinet("テスト副大臣内閣", "2030-01-01");
    const a = await newPerson("副大臣テストA");
    const b = await newPerson("副大臣テストB");
    expect((await createAppointment(db, cabinetId, valid({ personId: a }))).ok).toBe(true);
    expect((await createAppointment(db, cabinetId, valid({ personId: b }))).ok).toBe(true);
    const dup = await createAppointment(db, cabinetId, valid({ personId: a }));
    expect(dup).toMatchObject({
      ok: false,
      reason: "conflict",
      fields: { personId: "appointmentDuplicate" },
    });
    const detail = await getCabinetDetail(db, cabinetId);
    expect(detail!.roster.filter((row) => row.postName === "財務副大臣")).toHaveLength(2);
  });

  it("重なりを禁止する役職（財務大臣）は、同じ期間の 2 人目が postOverlap になる", async () => {
    const cabinetId = await newCabinet("テスト重なり内閣", "2031-01-01");
    const a = await newPerson("重なりテストA");
    const b = await newPerson("重なりテストB");
    expect(
      (await createAppointment(db, cabinetId, valid({ postName: "財務大臣", personId: a }))).ok,
    ).toBe(true);
    const second = await createAppointment(
      db,
      cabinetId,
      valid({ postName: "財務大臣", personId: b }),
    );
    expect(second).toMatchObject({ ok: false, fields: { postName: "postOverlap" } });
  });

  it("区分の表示順（閣僚 → 副長官 → 副大臣 → 政務官）で名簿に並び、期間の端・存在しない ID・他の内閣の ID を扱える", async () => {
    const cabinetId = await newCabinet("テスト並び内閣", "2032-01-01", "2032-12-31");
    const otherId = await newCabinet("テスト別内閣", "2033-01-01");
    const p = await newPerson("並びテストA");
    const posts = ["財務大臣政務官", "財務副大臣", "内閣官房副長官", "財務大臣"];
    for (const postName of posts) {
      expect((await createAppointment(db, cabinetId, valid({ postName, personId: p }))).ok).toBe(
        true,
      );
    }
    const detail = await getCabinetDetail(db, cabinetId);
    expect(detail!.roster.map((row) => row.postName)).toEqual([
      "財務大臣",
      "内閣官房副長官",
      "財務副大臣",
      "財務大臣政務官",
    ]);

    // 期間の端: 内閣の終了日ちょうどは通り、翌日は endOutsideCabinet
    const edgeOk = await createAppointment(
      db,
      cabinetId,
      valid({
        postName: "環境副大臣",
        personId: p,
        startDate: "2032-12-31",
        endDate: "2032-12-31",
      }),
    );
    expect(edgeOk.ok).toBe(true);
    const edgeNg = await createAppointment(
      db,
      cabinetId,
      valid({ postName: "環境副大臣", personId: p, endDate: "2033-01-01" }),
    );
    expect(edgeNg).toMatchObject({ ok: false, fields: { endDate: "endOutsideCabinet" } });

    // 存在しない内閣・人物は notFound / personNotFound
    expect(await createAppointment(db, 999999, valid({ personId: p }))).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await createAppointment(db, cabinetId, valid({ personId: 999999 }))).toMatchObject({
      ok: false,
      fields: { personId: "personNotFound" },
    });

    // 他の内閣の人事 ID を指定した修正・削除は notFound で、他の内閣の人事は消えない
    const created = await createAppointment(db, otherId, valid({ personId: p }));
    if (!created.ok) throw new Error("追加できませんでした");
    expect(await updateAppointment(db, cabinetId, created.id, valid({ personId: p }))).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await deleteAppointment(db, cabinetId, created.id)).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect(await deleteAppointment(db, cabinetId, 999999)).toEqual({
      ok: false,
      reason: "notFound",
    });
    expect((await getCabinetDetail(db, otherId))!.roster).toHaveLength(1);

    // 副大臣の修正（役職の変更）と削除
    const target = detail!.roster.find((row) => row.postName === "財務副大臣")!;
    expect(
      (
        await updateAppointment(
          db,
          cabinetId,
          target.id,
          valid({ postName: "外務副大臣", personId: p }),
        )
      ).ok,
    ).toBe(true);
    expect((await deleteAppointment(db, cabinetId, target.id)).ok).toBe(true);
    const after = await getCabinetDetail(db, cabinetId);
    expect(after!.roster.some((row) => row.id === target.id)).toBe(false);
  });
});

describe("省庁ページ", () => {
  it("存在しない府省 ID は null", async () => {
    expect(await getMinistryPage(db, 999999)).toBeNull();
    expect(await getMinistryPage(db, 0)).toBeNull();
  });

  it("財務省の大臣タブは加藤勝信を含み、就任日の新しい順で、日付は内閣の期間で補われる", async () => {
    const ministry = (await listMinistries(db)).find((m) => m.name === "財務省")!;
    const page = await getMinistryPage(db, ministry.id);
    const holders = page!.holders.minister;
    expect(holders.map((row) => row.personName)).toContain("加藤勝信");
    expect(holders.every((row) => row.postName === "財務大臣")).toBe(true);
    for (let i = 1; i < holders.length; i++) {
      expect(holders[i - 1]!.startDate >= holders[i]!.startDate).toBe(true);
    }
    const kato = holders.find((row) => row.cabinetName === "第1次石破内閣")!;
    expect(kato.personName).toBe("加藤勝信");
    expect(kato.startDate).toBe("2024-10-01");
    expect(kato.cabinetName).toBe("第1次石破内閣");
    // 現在の内閣の財務大臣は退任日なし（null）
    expect(holders.find((row) => row.cabinetName === "第2次高市内閣")!.endDate).toBeNull();
  });

  it("内閣詳細で追加した財務副大臣は、財務省の副大臣タブにだけ載る（政務官・他省庁には載らない）", async () => {
    const cabinetId = await newCabinet("テスト省庁内閣", "2034-01-01");
    const a = await newPerson("省庁テストA");
    const b = await newPerson("省庁テストB");
    await createAppointment(db, cabinetId, valid({ personId: a, startDate: "2034-03-01" }));
    await createAppointment(db, cabinetId, valid({ personId: b, startDate: "2034-05-01" }));
    await createAppointment(db, cabinetId, valid({ postName: "財務大臣政務官", personId: a }));
    const ministries = await listMinistries(db);
    const finance = await getMinistryPage(db, ministries.find((m) => m.name === "財務省")!.id);
    const names = finance!.holders.viceMinister
      .map((row) => row.personName)
      .filter((name) => name.startsWith("省庁テスト"));
    // 就任日の新しい順（5 月 → 3 月）
    expect(names).toEqual(["省庁テストB", "省庁テストA"]);
    expect(
      finance!.holders.parliamentaryVice
        .map((row) => row.personName)
        .filter((name) => name.startsWith("省庁テスト")),
    ).toEqual(["省庁テストA"]);
    const foreign = await getMinistryPage(db, ministries.find((m) => m.name === "外務省")!.id);
    expect(foreign!.holders.viceMinister).toEqual([]);
    // 大臣タブには副大臣の人事は載らない
    expect(finance!.holders.minister.some((row) => row.personName === "省庁テストB")).toBe(false);
  });

  it("人事が 1 件もない府省は、3 つの区分すべてが空（エラーにならない）", async () => {
    const ministries = await listMinistries(db);
    const page = await getMinistryPage(db, ministries.find((m) => m.name === "防衛省")!.id);
    expect(page!.holders.viceMinister).toEqual([]);
    expect(page!.holders.parliamentaryVice).toEqual([]);
  });

  it("人事を削除すると省庁ページからも消える", async () => {
    const cabinetId = await newCabinet("テスト削除内閣", "2035-01-01");
    const a = await newPerson("削除省庁テスト");
    const created = await createAppointment(
      db,
      cabinetId,
      valid({ postName: "環境副大臣", personId: a }),
    );
    if (!created.ok) throw new Error("追加できませんでした");
    const env = (await listMinistries(db)).find((m) => m.name === "環境省")!;
    const countTest = async () =>
      (await getMinistryPage(db, env.id))!.holders.viceMinister.filter(
        (row) => row.personName === "削除省庁テスト",
      ).length;
    expect(await countTest()).toBe(1);
    await deleteAppointment(db, cabinetId, created.id);
    expect(await countTest()).toBe(0);
    // 同じ内閣の人事テーブルにも残っていない
    const rows = await db.select().from(cabinetAppointments);
    expect(rows.some((row) => row.id === created.id)).toBe(false);
  });
});
