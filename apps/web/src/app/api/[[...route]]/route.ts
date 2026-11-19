import { Hono, type Context } from "hono";
import { handle } from "hono/vercel";
import {
  createAppointment,
  createCabinet,
  createPerson,
  deleteAppointment,
  deletePerson,
  getCabinetDetail,
  getPersonProfile,
  listCabinets,
  searchSuggestions,
  updateAppointment,
  updateCabinet,
  updatePerson,
  validateAppointmentInput,
  validateCabinetInput,
  validatePersonInput,
  type CabinetWriteResult,
  type PersonWriteResult,
} from "@japan-politics/db";
import { getAuth, getUserFromHeaders } from "@/lib/auth";
import { parseCabinetId } from "@/lib/cabinet-id";
import { searchQuerySchema } from "@/lib/search-query";
import { getDb } from "@/lib/db";
import { originGuard } from "@/lib/origin-guard";

/** Next.js の Route Handler に同居させる Hono の API。 */
export const app = new Hono().basePath("/api");

/**
 * 変更系リクエスト（POST / PUT / DELETE）を受け付ける Origin。
 * 要求先と同じ Origin に加え、環境変数 BETTER_AUTH_URL の Origin（本番の公開 URL）を許す。
 * @param origin リクエストの Origin ヘッダー
 * @param c Hono のコンテキスト
 * @returns 許すなら true
 */
function isAllowedOrigin(origin: string, c: Context): boolean {
  if (origin === new URL(c.req.url).origin) return true;
  const configured = process.env.BETTER_AUTH_URL;
  if (!configured) return false;
  try {
    return origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

// 外部のサイトから、ログイン中の管理者のブラウザ経由で変更系リクエストを送らせる攻撃（CSRF）を防ぐ。
// Origin が許可したもの以外の変更系リクエストは、形式（JSON か form か）によらず 403 にする。
app.use("*", originGuard(isAllowedOrigin));

// ログイン・登録・ログアウトは Better Auth に任せる
app.on(["GET", "POST"], "/auth/*", (c) => getAuth().handler(c.req.raw));

/**
 * 管理者だけを通すための確認。未ログインは 401、管理者でなければ 403 の応答を返す。
 * @param c Hono のコンテキスト
 * @returns 通せないときは応答（そのまま返す）。通してよいときは null
 */
async function rejectUnlessAdmin(c: Context): Promise<Response | null> {
  const current = await getUserFromHeaders(c.req.raw.headers);
  if (!current) return c.json({ error: "ログインが必要です" }, 401);
  if (current.role !== "admin") return c.json({ error: "管理者だけが使えます" }, 403);
  return null;
}

/**
 * 人物の書き込み結果を HTTP 応答にする。
 * @param c Hono のコンテキスト
 * @param result 書き込みの結果
 * @param successStatus 成功時のステータス
 * @returns 応答
 */
function personWriteResponse(c: Context, result: PersonWriteResult, successStatus: 200 | 201) {
  if (result.ok) return c.json({ id: result.id }, successStatus);
  if (result.reason === "duplicate") {
    return c.json({ error: "validation", fields: { name: "nameDuplicate" } }, 409);
  }
  if (result.reason === "hasCareers") {
    return c.json({ error: "経歴が登録されている人物は削除できません", code: "hasCareers" }, 409);
  }
  return c.json({ error: "人物が見つかりません" }, 404);
}

/**
 * リクエストの本文（JSON）を読む。JSON でなければ undefined にして、入力の検証で弾く。
 * @param c Hono のコンテキスト
 * @returns 本文
 */
async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/**
 * 内閣・閣僚人事の書き込み結果を HTTP 応答にする。
 * 入力の不正は 400、既存データとの食い違い（重複・期間の重なりなど）は 409、対象なしは 404。
 * @param c Hono のコンテキスト
 * @param result 書き込みの結果
 * @param successStatus 成功時のステータス
 * @returns 応答
 */
function cabinetWriteResponse(c: Context, result: CabinetWriteResult, successStatus: 200 | 201) {
  if (result.ok) return c.json({ id: result.id }, successStatus);
  if (result.reason === "notFound") {
    return c.json({ error: "対象が見つかりません", code: "notFound" }, 404);
  }
  return c.json(
    { error: "validation", fields: result.fields },
    result.reason === "invalid" ? 400 : 409,
  );
}

app.get("/cabinets", async (c) => c.json(await listCabinets(getDb())));

// 内閣を追加する（管理者だけ）。成功は 201 と { id }
app.post("/cabinets", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const parsed = validateCabinetInput(await readJsonBody(c));
  if (!parsed.ok) return c.json({ error: "validation", fields: parsed.errors }, 400);
  return cabinetWriteResponse(c, await createCabinet(getDb(), parsed.value), 201);
});

app.get("/cabinets/:id", async (c) => {
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "内閣 ID が不正です" }, 400);
  const detail = await getCabinetDetail(getDb(), id);
  if (!detail) return c.json({ error: "内閣が見つかりません" }, 404);
  return c.json(detail);
});

// 内閣を修正する（管理者だけ）
app.put("/cabinets/:id", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "内閣 ID が不正です" }, 400);
  const parsed = validateCabinetInput(await readJsonBody(c));
  if (!parsed.ok) return c.json({ error: "validation", fields: parsed.errors }, 400);
  return cabinetWriteResponse(c, await updateCabinet(getDb(), id, parsed.value), 200);
});

// 閣僚人事を追加する（管理者だけ）
app.post("/cabinets/:id/appointments", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const cabinetId = parseCabinetId(c.req.param("id"));
  if (cabinetId === null) return c.json({ error: "内閣 ID が不正です" }, 400);
  const parsed = validateAppointmentInput(await readJsonBody(c));
  if (!parsed.ok) return c.json({ error: "validation", fields: parsed.errors }, 400);
  return cabinetWriteResponse(c, await createAppointment(getDb(), cabinetId, parsed.value), 201);
});

// 閣僚人事を修正する（管理者だけ。別の内閣の人事 ID は 404）
app.put("/cabinets/:id/appointments/:appointmentId", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const cabinetId = parseCabinetId(c.req.param("id"));
  const appointmentId = parseCabinetId(c.req.param("appointmentId"));
  if (cabinetId === null || appointmentId === null) return c.json({ error: "ID が不正です" }, 400);
  const parsed = validateAppointmentInput(await readJsonBody(c));
  if (!parsed.ok) return c.json({ error: "validation", fields: parsed.errors }, 400);
  const result = await updateAppointment(getDb(), cabinetId, appointmentId, parsed.value);
  return cabinetWriteResponse(c, result, 200);
});

// 閣僚人事を削除する（管理者だけ。別の内閣の人事 ID は 404）
app.delete("/cabinets/:id/appointments/:appointmentId", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const cabinetId = parseCabinetId(c.req.param("id"));
  const appointmentId = parseCabinetId(c.req.param("appointmentId"));
  if (cabinetId === null || appointmentId === null) return c.json({ error: "ID が不正です" }, 400);
  return cabinetWriteResponse(c, await deleteAppointment(getDb(), cabinetId, appointmentId), 200);
});

// 人物を追加する（管理者だけ）。成功は 201 と { id }
app.post("/persons", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const parsed = validatePersonInput(await readJsonBody(c));
  if (!parsed.ok) return c.json({ error: "validation", fields: parsed.errors }, 400);
  return personWriteResponse(c, await createPerson(getDb(), parsed.value), 201);
});

app.get("/persons/:id", async (c) => {
  // 人物 ID も内閣 ID と同じ「1 以上の整数」の形式
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "人物 ID が不正です" }, 400);
  const profile = await getPersonProfile(getDb(), id);
  if (!profile) return c.json({ error: "人物が見つかりません" }, 404);
  return c.json(profile);
});

// 人物を修正する（管理者だけ）
app.put("/persons/:id", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "人物 ID が不正です" }, 400);
  const parsed = validatePersonInput(await readJsonBody(c));
  if (!parsed.ok) return c.json({ error: "validation", fields: parsed.errors }, 400);
  return personWriteResponse(c, await updatePerson(getDb(), id, parsed.value), 200);
});

// 人物を削除する（管理者だけ。経歴のある人物は 409）
app.delete("/persons/:id", async (c) => {
  const rejected = await rejectUnlessAdmin(c);
  if (rejected) return rejected;
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "人物 ID が不正です" }, 400);
  return personWriteResponse(c, await deletePerson(getDb(), id), 200);
});

app.get("/search", async (c) => {
  const parsed = searchQuerySchema.safeParse(c.req.query("q") ?? "");
  if (!parsed.success) return c.json({ error: "検索語が不正です" }, 400);
  return c.json(await searchSuggestions(getDb(), parsed.data));
});

export const dynamic = "force-dynamic";
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
