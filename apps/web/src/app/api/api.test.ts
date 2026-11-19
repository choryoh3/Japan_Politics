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

describe("内閣・閣僚人事の書き込み API", () => {
  const origin = "http://localhost:3000";
  const json = { "Content-Type": "application/json", Origin: origin };
  let adminCookie: string;
  let userCookie: string;
  let cabinetId: number;
  let personId: number;

  /** 登録して、以降のリクエストに付ける cookie を返す。 */
  async function registerCookie(email: string): Promise<string> {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: "テスト", email, password: "password1" }),
    });
    return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  }

  /** 認証つきで JSON の変更系リクエストを送る。 */
  function send(method: string, path: string, body?: unknown, cookie = adminCookie) {
    return app.request(path, {
      method,
      headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  beforeAll(async () => {
    adminCookie = await registerCookie("cabinet-admin@example.com");
    expect(await grantAdmin(createDb(), "cabinet-admin@example.com")).toEqual({ ok: true });
    userCookie = await registerCookie("cabinet-user@example.com");
    const created = await send("POST", "/api/cabinets", {
      name: "API試験内閣",
      startDate: "2026-01-01",
    });
    expect(created.status).toBe(201);
    cabinetId = ((await created.json()) as { id: number }).id;
    const person = await send("POST", "/api/persons", {
      name: "API試験人物",
      kana: "えーぴーあい",
    });
    personId = ((await person.json()) as { id: number }).id;
  });

  it("未ログインは 401、一般ユーザーは 403 で、内閣も人事も変更されない", async () => {
    const calls: [string, string, unknown][] = [
      ["POST", "/api/cabinets", { name: "不正内閣", startDate: "2026-01-01" }],
      ["PUT", `/api/cabinets/${cabinetId}`, { name: "改ざん", startDate: "2026-01-01" }],
      ["POST", `/api/cabinets/${cabinetId}/appointments`, { postName: "外務大臣", personId }],
      ["PUT", `/api/cabinets/${cabinetId}/appointments/1`, { postName: "外務大臣", personId }],
      ["DELETE", `/api/cabinets/${cabinetId}/appointments/1`, undefined],
    ];
    for (const [method, path, body] of calls) {
      expect((await send(method, path, body, "")).status, `${method} ${path}`).toBe(401);
      expect((await send(method, path, body, userCookie)).status, `${method} ${path}`).toBe(403);
    }
    const detail = (await (await app.request(`/api/cabinets/${cabinetId}`)).json()) as {
      name: string;
      roster: unknown[];
    };
    expect(detail).toMatchObject({ name: "API試験内閣", roster: [] });
    const list = (await (await app.request("/api/cabinets")).json()) as { name: string }[];
    expect(list.map((c) => c.name)).not.toContain("不正内閣");
  });

  it("内閣の入力エラーはコードで返り、追加されない（400）。重複は 409", async () => {
    const empty = await send("POST", "/api/cabinets", { name: "", startDate: "2026-01-01" });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({ fields: { name: "nameRequired" } });
    const before = await send("POST", "/api/cabinets", {
      name: "終了日エラー内閣",
      startDate: "2026-01-02",
      endDate: "2026-01-01",
    });
    expect(before.status).toBe(400);
    expect(await before.json()).toMatchObject({ fields: { endDate: "endDateBeforeStart" } });
    const bad = await send("POST", "/api/cabinets", { name: "あ\u0000", startDate: "2026-02-30" });
    expect(bad.status).toBe(400);
    expect(
      (await send("POST", "/api/cabinets", { name: "API試験内閣", startDate: "2026-03-01" }))
        .status,
    ).toBe(409);
    expect(
      (await send("PUT", "/api/cabinets/abc", { name: "x", startDate: "2026-01-01" })).status,
    ).toBe(400);
    expect(
      (await send("PUT", "/api/cabinets/999999", { name: "x", startDate: "2026-01-01" })).status,
    ).toBe(404);
    const list = (await (await app.request("/api/cabinets")).json()) as { name: string }[];
    expect(list.map((c) => c.name)).not.toContain("終了日エラー内閣");
  });

  it("閣僚人事の追加・修正・削除と、入力エラー・期間外・重なり・他の内閣の ID", async () => {
    const path = `/api/cabinets/${cabinetId}/appointments`;
    const ok = await send("POST", path, {
      postName: "内閣官房長官",
      personId,
      startDate: "2026-02-01",
      sourceUrl: "https://example.com/source",
      sourceNote: "テスト出典",
    });
    expect(ok.status).toBe(201);
    const { id } = (await ok.json()) as { id: number };

    const badUrl = await send("POST", path, { postName: "外務大臣", personId, sourceUrl: "abc" });
    expect(badUrl.status).toBe(400);
    expect(await badUrl.json()).toMatchObject({ fields: { sourceUrl: "sourceUrlInvalid" } });
    for (const sourceUrl of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"]) {
      expect((await send("POST", path, { postName: "外務大臣", personId, sourceUrl })).status).toBe(
        400,
      );
    }
    const early = await send("POST", path, {
      postName: "外務大臣",
      personId,
      startDate: "2025-12-31",
    });
    expect(early.status).toBe(400);
    expect(await early.json()).toMatchObject({ fields: { startDate: "startOutsideCabinet" } });
    const other = await send("POST", "/api/persons", {
      name: "API試験人物2",
      kana: "えーぴーあいに",
    });
    const otherId = ((await other.json()) as { id: number }).id;
    const overlap = await send("POST", path, { postName: "内閣官房長官", personId: otherId });
    expect(overlap.status).toBe(409);
    expect(await overlap.json()).toMatchObject({ fields: { postName: "postOverlap" } });
    expect((await send("POST", path, { postName: "外務大臣", personId: 999999 })).status).toBe(400);
    expect(
      (await send("POST", "/api/cabinets/999999/appointments", { postName: "外務大臣", personId }))
        .status,
    ).toBe(404);
    expect(
      (await send("POST", "/api/cabinets/abc/appointments", { postName: "外務大臣", personId }))
        .status,
    ).toBe(400);

    const roster = async () =>
      (
        (await (await app.request(`/api/cabinets/${cabinetId}`)).json()) as {
          roster: { id: number; sourceNote: string; endDate: string | null }[];
        }
      ).roster;
    expect(await roster()).toHaveLength(1);

    const put = await send("PUT", `${path}/${id}`, {
      postName: "内閣官房長官",
      personId,
      startDate: "2026-02-01",
      endDate: "2026-05-01",
      sourceUrl: "https://example.com/source",
      sourceNote: "更新後",
    });
    expect(put.status).toBe(200);
    expect((await roster())[0]).toMatchObject({ sourceNote: "更新後", endDate: "2026-05-01" });

    // 他の内閣の人事 ID を指定した修正・削除は 404 で、他の内閣のデータは変わらない
    const sibling = await send("POST", "/api/cabinets", {
      name: "API試験別内閣",
      startDate: "2026-01-01",
    });
    const siblingId = ((await sibling.json()) as { id: number }).id;
    expect(
      (
        await send("PUT", `/api/cabinets/${siblingId}/appointments/${id}`, {
          postName: "外務大臣",
          personId,
        })
      ).status,
    ).toBe(404);
    expect((await send("DELETE", `/api/cabinets/${siblingId}/appointments/${id}`)).status).toBe(
      404,
    );
    expect(await roster()).toHaveLength(1);
    expect((await send("DELETE", `${path}/999999`)).status).toBe(404);
    expect((await send("DELETE", `${path}/abc`)).status).toBe(400);

    expect((await send("DELETE", `${path}/${id}`)).status).toBe(200);
    expect(await roster()).toHaveLength(0);
  });

  it("経歴のある人物の削除は引き続き 409（回帰）", async () => {
    const hayashi = (
      (await (await app.request(`/api/search?q=${encodeURIComponent("林芳正")}`)).json()) as {
        persons: { id: number }[];
      }
    ).persons[0]!;
    const refused = await send("DELETE", `/api/persons/${hayashi.id}`);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "hasCareers" });
  });

  it("許可されていない Origin からの変更系リクエストは形式によらず 403。Origin 無しと許可した Origin は通る", async () => {
    const post = (contentType: string, originHeader?: string) =>
      app.request("/api/cabinets", {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          ...(originHeader === undefined ? {} : { Origin: originHeader }),
          Cookie: adminCookie,
        },
        body: JSON.stringify({ name: "外部から作った内閣", startDate: "2026-01-01" }),
      });
    for (const contentType of ["text/plain", "application/json"]) {
      expect((await post(contentType, "https://evil.example")).status).toBe(403);
      expect((await post(contentType, "null")).status).toBe(403);
    }
    const crossSite = await app.request(`/api/cabinets/${cabinetId}/appointments/1`, {
      method: "DELETE",
      headers: { Cookie: adminCookie, "Sec-Fetch-Site": "cross-site" },
    });
    expect(crossSite.status).toBe(403);
    const list = async () =>
      ((await (await app.request("/api/cabinets")).json()) as { name: string }[]).filter(
        (c) => c.name === "外部から作った内閣",
      );
    expect(await list()).toHaveLength(0);
    // 許可した Origin（BETTER_AUTH_URL）は通る。Origin が無い非ブラウザの呼び出しも通る（権限は別に確認される）
    expect((await post("application/json", origin)).status).toBe(201);
    expect((await post("application/json")).status).toBe(409);
    expect(await list()).toHaveLength(1);
  });
});
