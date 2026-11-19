import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { postNamesForMinistry, type PostCategory } from "./cabinet-posts.ts";
import { cabinetAppointments, cabinets, ministries, persons } from "./schema.ts";
import { resolveTenure } from "./tenure.ts";

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
  personId: number;
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
      personId: persons.id,
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

/** 人物ページの経歴 1 行分。日付は内閣の期間で補った実際の就任日・退任日。 */
export interface CareerRow {
  id: number;
  postName: string;
  cabinetId: number;
  cabinetName: string;
  /** 就任日（人事に日付がなければ内閣の発足日） */
  startDate: string;
  /** 退任日（人事に日付がなければ内閣の終了日。null は現在も在任） */
  endDate: string | null;
  sourceUrl: string;
  sourceNote: string;
}

/** 人物ページの内容。 */
export interface PersonProfile {
  id: number;
  name: string;
  kana: string;
  /** 生年月日（「YYYY-MM-DD」。未登録なら null） */
  birthDate: string | null;
  /** メモ（未登録なら null） */
  memo: string | null;
  /** 就任日の新しい順 */
  careers: CareerRow[];
}

/**
 * 人物 1 人と経歴（就任したすべての役職）を返す。経歴は就任日の新しい順。
 * @param db DB ハンドル
 * @param id 人物 ID
 * @returns 人物と経歴。存在しなければ null
 */
export async function getPersonProfile(db: Db, id: number): Promise<PersonProfile | null> {
  const [person] = await db.select().from(persons).where(eq(persons.id, id));
  if (!person) return null;
  const rows = await db
    .select({
      id: cabinetAppointments.id,
      postName: cabinetAppointments.postName,
      sortOrder: cabinetAppointments.sortOrder,
      cabinetId: cabinets.id,
      cabinetName: cabinets.name,
      cabinetStart: cabinets.startDate,
      cabinetEnd: cabinets.endDate,
      startDate: cabinetAppointments.startDate,
      endDate: cabinetAppointments.endDate,
      sourceUrl: cabinetAppointments.sourceUrl,
      sourceNote: cabinetAppointments.sourceNote,
    })
    .from(cabinetAppointments)
    .innerJoin(cabinets, eq(cabinets.id, cabinetAppointments.cabinetId))
    .where(eq(cabinetAppointments.personId, id));
  const careers = rows
    .map((row) => ({
      id: row.id,
      postName: row.postName,
      sortOrder: row.sortOrder,
      cabinetId: row.cabinetId,
      cabinetName: row.cabinetName,
      // 人事に日付がなければ、内閣の期間がそのまま在任期間になる
      startDate: row.startDate ?? row.cabinetStart,
      endDate: row.endDate ?? row.cabinetEnd,
      sourceUrl: row.sourceUrl,
      sourceNote: row.sourceNote,
    }))
    // 就任日の新しい順。同じ日は名簿の順（役職の順）に並べて、結果を毎回同じにする
    .sort((a, b) =>
      a.startDate === b.startDate ? a.sortOrder - b.sortOrder : a.startDate < b.startDate ? 1 : -1,
    )
    .map((row) => ({
      id: row.id,
      postName: row.postName,
      cabinetId: row.cabinetId,
      cabinetName: row.cabinetName,
      startDate: row.startDate,
      endDate: row.endDate,
      sourceUrl: row.sourceUrl,
      sourceNote: row.sourceNote,
    }));
  return {
    id: person.id,
    name: person.name,
    kana: person.kana,
    birthDate: person.birthDate,
    memo: person.memo,
    careers,
  };
}

/** 検索候補の 1 件。 */
export interface SearchSuggestions {
  persons: { id: number; name: string; kana: string }[];
  cabinets: { id: number; name: string }[];
}

/** 候補の最大件数（人物・内閣それぞれ）。 */
const SUGGESTION_LIMIT = 8;

/**
 * 検索語をカタカナ→ひらがなにそろえる。「カトウ」でも「かとう」の人物が見つかるようにするため。
 * @param text 検索語
 * @returns ひらがなにそろえた文字列
 */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * LIKE の特殊文字（% _ \）を、文字そのものとして検索できるようにエスケープする。
 * @param text 検索語
 * @returns エスケープ後の文字列（ESCAPE '\\' 前提）
 */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * 人物（氏名・よみがな）と内閣（内閣名）を部分一致で検索して、候補を返す。
 * @param db DB ハンドル
 * @param query 検索語（前後の空白は無視する。空なら候補なし）
 * @returns 人物と内閣の候補
 */
export async function searchSuggestions(db: Db, query: string): Promise<SearchSuggestions> {
  const trimmed = query.trim();
  if (trimmed === "") return { persons: [], cabinets: [] };
  const pattern = `%${escapeLike(trimmed)}%`;
  const kanaPattern = `%${escapeLike(katakanaToHiragana(trimmed))}%`;
  const personRows = await db
    .select({ id: persons.id, name: persons.name, kana: persons.kana })
    .from(persons)
    .where(
      or(
        sql`${persons.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${persons.kana} LIKE ${kanaPattern} ESCAPE '\\'`,
      ),
    )
    .orderBy(asc(persons.kana))
    .limit(SUGGESTION_LIMIT);
  const cabinetRows = await db
    .select({ id: cabinets.id, name: cabinets.name })
    .from(cabinets)
    .where(sql`${cabinets.name} LIKE ${pattern} ESCAPE '\\'`)
    .orderBy(desc(cabinets.startDate))
    .limit(SUGGESTION_LIMIT);
  return { persons: personRows, cabinets: cabinetRows };
}

/** 省庁一覧の 1 行分。 */
export interface MinistryListItem {
  id: number;
  name: string;
}

/**
 * 府省を一覧の表示順で返す。
 * @param db DB ハンドル
 * @returns 府省の一覧
 */
export async function listMinistries(db: Db): Promise<MinistryListItem[]> {
  return db
    .select({ id: ministries.id, name: ministries.name })
    .from(ministries)
    .orderBy(asc(ministries.sortOrder), asc(ministries.id));
}

/** 省庁ページの 1 行分（ある人物がある内閣である役職に就いた記録）。日付は内閣の期間で補った実際の在任期間。 */
export interface MinistryTenureRow {
  /** 人事 ID */
  id: number;
  personId: number;
  personName: string;
  postName: string;
  cabinetId: number;
  cabinetName: string;
  /** 就任日 */
  startDate: string;
  /** 退任日（null は現在も在任） */
  endDate: string | null;
}

/** 省庁ページの内容。 */
export interface MinistryPage {
  id: number;
  name: string;
  /** 区分ごとの歴代の在任者。就任日の新しい順 */
  holders: Record<
    Extract<PostCategory, "minister" | "viceMinister" | "parliamentaryVice">,
    MinistryTenureRow[]
  >;
}

/**
 * 府省 1 件と、歴代の大臣・副大臣・大臣政務官を返す。各区分は就任日の新しい順
 * （同じ日は内閣の発足が新しい順、それも同じなら名簿の順）。
 * @param db DB ハンドル
 * @param id 府省 ID
 * @returns 省庁ページの内容。存在しなければ null
 */
export async function getMinistryPage(db: Db, id: number): Promise<MinistryPage | null> {
  const [ministry] = await db.select().from(ministries).where(eq(ministries.id, id));
  if (!ministry) return null;

  /**
   * 1 つの区分の在任者を取り出して並べる。
   * @param category 役職の区分
   */
  const load = async (
    category: "minister" | "viceMinister" | "parliamentaryVice",
  ): Promise<MinistryTenureRow[]> => {
    const postNames = postNamesForMinistry(ministry.name, category);
    if (postNames.length === 0) return [];
    const rows = await db
      .select({
        id: cabinetAppointments.id,
        sortOrder: cabinetAppointments.sortOrder,
        postName: cabinetAppointments.postName,
        personId: persons.id,
        personName: persons.name,
        cabinetId: cabinets.id,
        cabinetName: cabinets.name,
        cabinetStart: cabinets.startDate,
        cabinetEnd: cabinets.endDate,
        startDate: cabinetAppointments.startDate,
        endDate: cabinetAppointments.endDate,
      })
      .from(cabinetAppointments)
      .innerJoin(persons, eq(persons.id, cabinetAppointments.personId))
      .innerJoin(cabinets, eq(cabinets.id, cabinetAppointments.cabinetId))
      .where(inArray(cabinetAppointments.postName, postNames));
    return rows
      .map((row) => {
        const tenure = resolveTenure(row, { startDate: row.cabinetStart, endDate: row.cabinetEnd });
        return { row, tenure };
      })
      .sort((a, b) => {
        if (a.tenure.start !== b.tenure.start) return a.tenure.start < b.tenure.start ? 1 : -1;
        if (a.row.cabinetStart !== b.row.cabinetStart) {
          return a.row.cabinetStart < b.row.cabinetStart ? 1 : -1;
        }
        return a.row.sortOrder - b.row.sortOrder || a.row.id - b.row.id;
      })
      .map(({ row, tenure }) => ({
        id: row.id,
        personId: row.personId,
        personName: row.personName,
        postName: row.postName,
        cabinetId: row.cabinetId,
        cabinetName: row.cabinetName,
        startDate: tenure.start,
        endDate: tenure.end,
      }));
  };

  return {
    id: ministry.id,
    name: ministry.name,
    holders: {
      minister: await load("minister"),
      viceMinister: await load("viceMinister"),
      parliamentaryVice: await load("parliamentaryVice"),
    },
  };
}
