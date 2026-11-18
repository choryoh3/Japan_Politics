import { Hono } from "hono";
import { handle } from "hono/vercel";
import {
  getCabinetDetail,
  getPersonProfile,
  listCabinets,
  searchSuggestions,
} from "@japan-politics/db";
import { parseCabinetId } from "@/lib/cabinet-id";
import { searchQuerySchema } from "@/lib/search-query";
import { getDb } from "@/lib/db";

/** Next.js の Route Handler に同居させる Hono の API。 */
export const app = new Hono().basePath("/api");

app.get("/cabinets", async (c) => c.json(await listCabinets(getDb())));

app.get("/cabinets/:id", async (c) => {
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "内閣 ID が不正です" }, 400);
  const detail = await getCabinetDetail(getDb(), id);
  if (!detail) return c.json({ error: "内閣が見つかりません" }, 404);
  return c.json(detail);
});

app.get("/persons/:id", async (c) => {
  // 人物 ID も内閣 ID と同じ「1 以上の整数」の形式
  const id = parseCabinetId(c.req.param("id"));
  if (id === null) return c.json({ error: "人物 ID が不正です" }, 400);
  const profile = await getPersonProfile(getDb(), id);
  if (!profile) return c.json({ error: "人物が見つかりません" }, 404);
  return c.json(profile);
});

app.get("/search", async (c) => {
  const parsed = searchQuerySchema.safeParse(c.req.query("q") ?? "");
  if (!parsed.success) return c.json({ error: "検索語が不正です" }, 400);
  return c.json(await searchSuggestions(getDb(), parsed.data));
});

export const dynamic = "force-dynamic";
export const GET = handle(app);
