import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { cabinetAppointments, cabinets, persons } from "./schema.ts";

/** 内閣一覧の 1 行分。 */
export interface CabinetListItem {
  id: number;
  name: string;
  startDate: string;
  /** null は現在の内閣 */
  endDate: string | null;
  /** 内閣総理大臣の氏名（未登録なら null） */
  primeMinisterName: string | null;
}

/** 閣僚名簿の 1 行分。 */
export interface RosterRow {
  id: number;
  postName: string;
  personName: string;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
  sourceNote: string;
}

/** 内閣詳細。 */
export interface CabinetDetail {
  id: number;
  name: string;
  startDate: string;
  endDate: string | null;
  roster: RosterRow[];
}

/** 内閣総理大臣の役職名。一覧に首相名を出すために使う。 */
const PRIME_MINISTER_POST = "内閣総理大臣";

/**
 * 内閣を発足日の新しい順に返す。各内閣の首相の氏名つき。
 * @param db DB ハンドル
 * @returns 内閣一覧
 */
export async function listCabinets(db: Db): Promise<CabinetListItem[]> {
  const rows = await db.select().from(cabinets).orderBy(desc(cabinets.startDate));
  const pms = await db
    .select({ cabinetId: cabinetAppointments.cabinetId, name: persons.name })
    .from(cabinetAppointments)
    .innerJoin(persons, eq(persons.id, cabinetAppointments.personId))
    .where(eq(cabinetAppointments.postName, PRIME_MINISTER_POST))
    .orderBy(asc(cabinetAppointments.sortOrder));
  const pmByCabinet = new Map<number, string>();
  for (const pm of pms) {
    if (!pmByCabinet.has(pm.cabinetId)) pmByCabinet.set(pm.cabinetId, pm.name);
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    primeMinisterName: pmByCabinet.get(row.id) ?? null,
  }));
}

/**
 * 内閣 1 件と閣僚名簿を返す。名簿は表示順（役職の順、同じ役職は在任の古い順）。
 * @param db DB ハンドル
 * @param id 内閣 ID
 * @returns 内閣詳細。存在しなければ null
 */
export async function getCabinetDetail(db: Db, id: number): Promise<CabinetDetail | null> {
  const [cabinet] = await db.select().from(cabinets).where(eq(cabinets.id, id));
  if (!cabinet) return null;
  const roster = await db
    .select({
      id: cabinetAppointments.id,
      postName: cabinetAppointments.postName,
      personName: persons.name,
      startDate: cabinetAppointments.startDate,
      endDate: cabinetAppointments.endDate,
      sourceUrl: cabinetAppointments.sourceUrl,
      sourceNote: cabinetAppointments.sourceNote,
    })
    .from(cabinetAppointments)
    .innerJoin(persons, eq(persons.id, cabinetAppointments.personId))
    .where(eq(cabinetAppointments.cabinetId, id))
    .orderBy(asc(cabinetAppointments.sortOrder), asc(cabinetAppointments.id));
  return { ...cabinet, roster };
}
