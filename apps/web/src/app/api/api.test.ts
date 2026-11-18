import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@japan-politics/db";
import { runMigrations } from "../../../../../packages/db/src/migrate";
import { seedInitialData } from "../../../../../packages/db/src/seed";

let dir: string;
let app: typeof import("./[[...route]]/route").app;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "jp-api-"));
  process.env.DATABASE_URL = `file:${join(dir, "api.db")}`;
  const db = createDb();
  await runMigrations(db);
  await seedInitialData(db);
  ({ app } = await import("./[[...route]]/route"));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("内閣 API", () => {
  it("一覧が発足日の新しい順で返る", async () => {
    const res = await app.request("/api/cabinets");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; startDate: string }[];
    expect(body.length).toBeGreaterThanOrEqual(8);
    expect(body.at(-1)?.name).toBe("菅内閣");
  });

  it("存在しない ID は 404、不正な ID は 400", async () => {
    expect((await app.request("/api/cabinets/999999")).status).toBe(404);
    expect((await app.request("/api/cabinets/abc")).status).toBe(400);
  });
});
