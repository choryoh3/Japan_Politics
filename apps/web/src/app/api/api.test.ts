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

describe("人物・検索 API", () => {
  it("検索 API が人物と内閣の候補を返す", async () => {
    const res = await app.request(`/api/search?q=${encodeURIComponent("石破")}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      persons: { id: number; name: string }[];
      cabinets: unknown[];
    };
    expect(body.persons.map((p) => p.name)).toContain("石破茂");
    const person = await app.request(`/api/persons/${body.persons[0]!.id}`);
    expect(person.status).toBe(200);
  });

  it("長すぎる検索語は 400、存在しない人物は 404、不正な人物 ID は 400", async () => {
    expect((await app.request(`/api/search?q=${"あ".repeat(51)}`)).status).toBe(400);
    expect((await app.request("/api/persons/999999")).status).toBe(404);
    expect((await app.request("/api/persons/abc")).status).toBe(400);
  });
});
