import { Hono } from "hono";
import { handle } from "hono/vercel";
import { getCabinetDetail, listCabinets } from "@japan-politics/db";
import { parseCabinetId } from "@/lib/cabinet-id";
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

export const dynamic = "force-dynamic";
export const GET = handle(app);
