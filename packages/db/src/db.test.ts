import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import { getCabinetDetail, listCabinets } from "./queries.ts";
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
