import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, grantAdmin, user } from "@japan-politics/db";
import { runMigrations } from "../../../../../packages/db/src/migrate";
import { seedInitialData } from "../../../../../packages/db/src/seed";

let dir: string;
let app: typeof import("./[[...route]]/route").app;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "jp-api-"));
  process.env.DATABASE_URL = `file:${join(dir, "api.db")}`;
  // テスト専用のダミー値（本物のシークレットではない）。.env.local が無い CI でも動くようにする
  process.env.BETTER_AUTH_SECRET = "test-only-dummy-secret-for-vitest-0123456789";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
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

describe("認証と人物の書き込み API", () => {
  const origin = "http://localhost:3000";
  const json = { "Content-Type": "application/json", Origin: origin };

  /** 登録して、以降のリクエストに付ける cookie を返す。 */
  async function register(email: string, password = "password1") {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: "テスト", email, password }),
    });
    const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    return { res, cookie };
  }

  /** 人物を追加する API を呼ぶ。 */
  function postPerson(body: unknown, cookie?: string) {
    return app.request("/api/persons", {
      method: "POST",
      headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
  }

  /** メールアドレスのアカウントを管理者にする（付与コマンドと同じ関数）。 */
  async function makeAdmin(email: string) {
    expect(await grantAdmin(createDb(), email)).toEqual({ ok: true });
  }

  it("8 文字のパスワードで登録でき、7 文字は拒否される", async () => {
    const ok = await register("eight@example.com", "12345678");
    expect(ok.res.status).toBe(200);
    expect(ok.cookie).toContain("session_token");
    const ng = await register("seven@example.com", "1234567");
    expect(ng.res.status).toBe(400);
    expect(ng.cookie).toBe("");
  });

  it("登録時に role: admin を送っても一般ユーザーのまま", async () => {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        name: "x",
        email: "evil@example.com",
        password: "password1",
        role: "admin",
      }),
    });
    const row = (await createDb().select().from(user)).find((u) => u.email === "evil@example.com");
    expect(row?.role).toBe("user");
    expect(res.status).not.toBe(500);
  });

  it("未ログインは 401、一般ユーザーは 403 で、人物は追加されない", async () => {
    const body = { name: "追加禁止", kana: "ついかきんし" };
    expect((await postPerson(body)).status).toBe(401);
    const { cookie } = await register("general@example.com");
    expect((await postPerson(body, cookie)).status).toBe(403);
    const search = await app.request(`/api/search?q=${encodeURIComponent("追加禁止")}`);
    expect(((await search.json()) as { persons: unknown[] }).persons).toEqual([]);
    const put = await app.request("/api/persons/1", { method: "PUT", headers: json, body: "{}" });
    expect(put.status).toBe(401);
    const del = await app.request("/api/persons/1", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(403);
  });

  it("管理者は追加・修正・削除でき、入力エラーは 400、氏名の重複は 409", async () => {
    const { cookie } = await register("admin@example.com");
    await makeAdmin("admin@example.com");
    const created = await postPerson({ name: "管理太郎", kana: "かんりたろう" }, cookie);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };

    const kataka = await postPerson({ name: "別人", kana: "カタカナ" }, cookie);
    expect(kataka.status).toBe(400);
    expect(await kataka.json()).toMatchObject({ fields: { kana: "kanaNotHiragana" } });
    expect((await postPerson({ name: "管理太郎", kana: "あ" }, cookie)).status).toBe(409);

    for (const bad of ["\u0000先頭", "管理太郎\u0000別物", "管理\u0007", "管理\n太郎"]) {
      const res = await postPerson({ name: bad, kana: "あ" }, cookie);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ fields: { name: "nameInvalidChar" } });
    }
    const badKana = await postPerson({ name: "別人2", kana: "あ\u0000" }, cookie);
    expect(badKana.status).toBe(400);
    expect(await badKana.json()).toMatchObject({ fields: { kana: "kanaInvalidChar" } });

    const put = await app.request(`/api/persons/${id}`, {
      method: "PUT",
      headers: { ...json, Cookie: cookie },
      body: JSON.stringify({ name: "管理次郎", kana: "かんりじろう", memo: "メモ" }),
    });
    expect(put.status).toBe(200);
    const profile = (await (await app.request(`/api/persons/${id}`)).json()) as {
      name: string;
      memo: string;
    };
    expect(profile).toMatchObject({ name: "管理次郎", memo: "メモ" });

    const del = await app.request(`/api/persons/${id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);
    expect((await app.request(`/api/persons/${id}`)).status).toBe(404);

    const careerPerson = (
      (await (await app.request(`/api/search?q=${encodeURIComponent("石破茂")}`)).json()) as {
        persons: { id: number }[];
      }
    ).persons[0]!;
    const refused = await app.request(`/api/persons/${careerPerson.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(refused.status).toBe(409);
  });
});
