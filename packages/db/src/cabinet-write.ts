import { and, asc, eq, gte, ne, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import type { AppointmentInput, CabinetInput } from "./cabinet-input.ts";
import { isSoloPost, postRank } from "./cabinet-posts.ts";
import { isUniqueViolation } from "./person-write.ts";
import { cabinetAppointments, cabinets, persons } from "./schema.ts";
import { resolveTenure, tenuresOverlap } from "./tenure.ts";

/** トランザクション内で使う DB ハンドルの型。 */
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** 項目ごとのエラーコード（画面が辞書で日本語にする）。 */
export type FieldErrors = Record<string, string>;

/**
 * 内閣・閣僚人事の書き込みの結果。失敗の理由はコードで返す。
 * notFound は対象の内閣・人事がない、invalid は入力が不正（400）、conflict は既存データと食い違う（409）。
 */
export type CabinetWriteResult =
  | { ok: true; id: number }
  | { ok: false; reason: "notFound" }
  | { ok: false; reason: "invalid" | "conflict"; fields: FieldErrors };

/**
 * 内閣名の重複判定用のキー。半角・全角の違い（NFKC）、大文字小文字、空白の有無を無視する。
 * 「第１次岸田内閣」と「第1次岸田内閣」のように、見た目がほぼ同じ別表記の重複登録を防ぐ。
 * @param name 内閣名
 * @returns 比較用のキー
 */
export function cabinetNameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/**
 * 同じ内閣名（表記ゆれを含む）の内閣が既にあるかを調べる。
 * @param tx DB ハンドル
 * @param name 正規化済みの内閣名
 * @param exceptId 調べる対象から外す内閣 ID（修正時の自分自身）
 * @returns 重複があれば true
 */
async function hasDuplicateName(tx: Tx, name: string, exceptId?: number): Promise<boolean> {
  const key = cabinetNameKey(name);
  const rows = await tx.select({ id: cabinets.id, name: cabinets.name }).from(cabinets);
  return rows.some((row) => row.id !== exceptId && cabinetNameKey(row.name) === key);
}

/**
 * 内閣を追加する。
 * @param db DB ハンドル
 * @param input 検証済みの入力
 * @returns 追加した内閣の ID。同じ内閣名があれば conflict
 */
export async function createCabinet(db: Db, input: CabinetInput): Promise<CabinetWriteResult> {
  try {
    return await db.transaction(async (tx): Promise<CabinetWriteResult> => {
      if (await hasDuplicateName(tx, input.name)) {
        return { ok: false, reason: "conflict", fields: { name: "nameDuplicate" } };
      }
      const [row] = await tx
        .insert(cabinets)
        .values({ name: input.name, startDate: input.startDate, endDate: input.endDate })
        .returning({ id: cabinets.id });
      return { ok: true, id: row!.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "conflict", fields: { name: "nameDuplicate" } };
    }
    throw error;
  }
}

/**
 * 内閣を修正する。新しい期間の外に出てしまう人事（日付つき）があるときは拒否する。
 * @param db DB ハンドル
 * @param id 内閣 ID
 * @param input 検証済みの入力
 * @returns 成功、または notFound / invalid / conflict
 */
export async function updateCabinet(
  db: Db,
  id: number,
  input: CabinetInput,
): Promise<CabinetWriteResult> {
  try {
    return await db.transaction(async (tx): Promise<CabinetWriteResult> => {
      const [current] = await tx.select().from(cabinets).where(eq(cabinets.id, id));
      if (!current) return { ok: false, reason: "notFound" };
      if (await hasDuplicateName(tx, input.name, id)) {
        return { ok: false, reason: "conflict", fields: { name: "nameDuplicate" } };
      }

      // 日付が入っている人事は、新しい期間の中に収まっていなければならない（空欄の人事は内閣の期間に追従する）
      const rows = await tx
        .select({ startDate: cabinetAppointments.startDate, endDate: cabinetAppointments.endDate })
        .from(cabinetAppointments)
        .where(eq(cabinetAppointments.cabinetId, id));
      const dates = rows.flatMap((row) => [row.startDate, row.endDate]);
      const fields: FieldErrors = {};
      if (dates.some((date) => date !== null && date < input.startDate)) {
        fields.startDate = "appointmentBeforeStart";
      }
      if (input.endDate !== null) {
        const end = input.endDate;
        if (dates.some((date) => date !== null && date > end)) {
          fields.endDate = "appointmentAfterEnd";
        }
      }
      if (Object.keys(fields).length > 0) return { ok: false, reason: "conflict", fields };

      await tx
        .update(cabinets)
        .set({ name: input.name, startDate: input.startDate, endDate: input.endDate })
        .where(eq(cabinets.id, id));
      return { ok: true, id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "conflict", fields: { name: "nameDuplicate" } };
    }
    throw error;
  }
}

/** 内閣の期間（人事の検査に使う）。 */
interface CabinetPeriod {
  id: number;
  startDate: string;
  endDate: string | null;
}

/**
 * 閣僚人事の入力を、DB の状態と突き合わせて検査する。
 * 1) 人物が存在する 2) 就任日・退任日が内閣の在任期間内 3) 単独の役職は在任期間が重ならない
 * 4) 同じ内閣で同じ役職に同じ人物を二重に登録しない。
 * @param tx DB ハンドル
 * @param cabinet 内閣の期間
 * @param input 検証済みの入力
 * @param selfId 修正のとき、検査から外す自分自身の人事 ID
 * @returns 問題があればその結果、なければ null
 */
async function checkAppointment(
  tx: Tx,
  cabinet: CabinetPeriod,
  input: AppointmentInput,
  selfId?: number,
): Promise<Extract<CabinetWriteResult, { ok: false; fields: FieldErrors }> | null> {
  const invalid: FieldErrors = {};

  const [person] = await tx
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.id, input.personId));
  if (!person) invalid.personId = "personNotFound";

  // 日付は「YYYY-MM-DD」なので、文字列の大小がそのまま日付の前後になる
  const withinCabinet = (date: string): boolean =>
    date >= cabinet.startDate && (cabinet.endDate === null || date <= cabinet.endDate);
  if (input.startDate !== null && !withinCabinet(input.startDate)) {
    invalid.startDate = "startOutsideCabinet";
  }
  if (input.endDate !== null && !withinCabinet(input.endDate)) {
    invalid.endDate = "endOutsideCabinet";
  }
  if (Object.keys(invalid).length > 0) return { ok: false, reason: "invalid", fields: invalid };

  const others = await tx
    .select({
      id: cabinetAppointments.id,
      personId: cabinetAppointments.personId,
      startDate: cabinetAppointments.startDate,
      endDate: cabinetAppointments.endDate,
    })
    .from(cabinetAppointments)
    .where(
      and(
        eq(cabinetAppointments.cabinetId, cabinet.id),
        eq(cabinetAppointments.postName, input.postName),
        selfId === undefined ? undefined : ne(cabinetAppointments.id, selfId),
      ),
    );

  if (isSoloPost(input.postName)) {
    const mine = resolveTenure(input, cabinet);
    if (others.some((other) => tenuresOverlap(mine, resolveTenure(other, cabinet)))) {
      return { ok: false, reason: "conflict", fields: { postName: "postOverlap" } };
    }
  }
  if (others.some((other) => other.personId === input.personId)) {
    return { ok: false, reason: "conflict", fields: { personId: "appointmentDuplicate" } };
  }
  return null;
}

/**
 * 名簿の中で新しい人事を置く位置（sortOrder）を決め、その位置を空けるために後ろの行を 1 つずらす。
 * 同じ役職がすでにあれば就任日の順でその並びに入れ、なければ標準の役職の順（CABINET_POSTS）に従う。
 * 初期データの内閣の並びは変えない（既存の行の相対的な順番は保つ）。
 * @param tx DB ハンドル
 * @param cabinet 内閣の期間
 * @param input 検証済みの入力
 * @param selfId 修正のとき、並びの計算から外す自分自身の人事 ID
 * @returns 新しい人事の sortOrder
 */
async function makeRoomInRoster(
  tx: Tx,
  cabinet: CabinetPeriod,
  input: AppointmentInput,
  selfId?: number,
): Promise<number> {
  const rows = await tx
    .select({
      postName: cabinetAppointments.postName,
      sortOrder: cabinetAppointments.sortOrder,
      startDate: cabinetAppointments.startDate,
    })
    .from(cabinetAppointments)
    .where(
      and(
        eq(cabinetAppointments.cabinetId, cabinet.id),
        selfId === undefined ? undefined : ne(cabinetAppointments.id, selfId),
      ),
    )
    .orderBy(asc(cabinetAppointments.sortOrder), asc(cabinetAppointments.id));

  const samePost = rows.filter((row) => row.postName === input.postName);
  const newStart = input.startDate ?? cabinet.startDate;
  let target: number;
  if (samePost.length > 0) {
    const next = samePost.find((row) => (row.startDate ?? cabinet.startDate) > newStart);
    target = next ? next.sortOrder : samePost[samePost.length - 1]!.sortOrder + 1;
  } else {
    const rank = postRank(input.postName);
    const later = rows.filter((row) => postRank(row.postName) > rank);
    if (later.length > 0) target = Math.min(...later.map((row) => row.sortOrder));
    else target = rows.length > 0 ? Math.max(...rows.map((row) => row.sortOrder)) + 1 : 0;
  }
  await tx
    .update(cabinetAppointments)
    .set({ sortOrder: sql`${cabinetAppointments.sortOrder} + 1` })
    .where(
      and(
        eq(cabinetAppointments.cabinetId, cabinet.id),
        gte(cabinetAppointments.sortOrder, target),
      ),
    );
  return target;
}

/**
 * 閣僚人事を追加する。
 * @param db DB ハンドル
 * @param cabinetId 内閣 ID
 * @param input 検証済みの入力
 * @returns 追加した人事の ID、または notFound / invalid / conflict
 */
export async function createAppointment(
  db: Db,
  cabinetId: number,
  input: AppointmentInput,
): Promise<CabinetWriteResult> {
  try {
    return await db.transaction(async (tx): Promise<CabinetWriteResult> => {
      const [cabinet] = await tx.select().from(cabinets).where(eq(cabinets.id, cabinetId));
      if (!cabinet) return { ok: false, reason: "notFound" };
      const problem = await checkAppointment(tx, cabinet, input);
      if (problem) return problem;
      const sortOrder = await makeRoomInRoster(tx, cabinet, input);
      const [row] = await tx
        .insert(cabinetAppointments)
        .values({ cabinetId, ...input, sortOrder })
        .returning({ id: cabinetAppointments.id });
      return { ok: true, id: row!.id };
    });
  } catch (error) {
    // 検査と書き込みのすき間に同じ人事が入った場合の最後の砦（一意制約）
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "conflict", fields: { personId: "appointmentDuplicate" } };
    }
    throw error;
  }
}

/**
 * 閣僚人事を修正する。別の内閣の人事 ID を指定したときは notFound。
 * @param db DB ハンドル
 * @param cabinetId 内閣 ID
 * @param appointmentId 人事 ID
 * @param input 検証済みの入力
 * @returns 成功、または notFound / invalid / conflict
 */
export async function updateAppointment(
  db: Db,
  cabinetId: number,
  appointmentId: number,
  input: AppointmentInput,
): Promise<CabinetWriteResult> {
  try {
    return await db.transaction(async (tx): Promise<CabinetWriteResult> => {
      const [cabinet] = await tx.select().from(cabinets).where(eq(cabinets.id, cabinetId));
      if (!cabinet) return { ok: false, reason: "notFound" };
      const [existing] = await tx
        .select({ id: cabinetAppointments.id })
        .from(cabinetAppointments)
        .where(
          and(
            eq(cabinetAppointments.id, appointmentId),
            eq(cabinetAppointments.cabinetId, cabinetId),
          ),
        );
      if (!existing) return { ok: false, reason: "notFound" };
      const problem = await checkAppointment(tx, cabinet, input, appointmentId);
      if (problem) return problem;
      const sortOrder = await makeRoomInRoster(tx, cabinet, input, appointmentId);
      await tx
        .update(cabinetAppointments)
        .set({ ...input, sortOrder })
        .where(eq(cabinetAppointments.id, appointmentId));
      return { ok: true, id: appointmentId };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "conflict", fields: { personId: "appointmentDuplicate" } };
    }
    throw error;
  }
}

/**
 * 閣僚人事を削除する。別の内閣の人事 ID を指定したときは notFound（他の内閣の人事は消さない）。
 * @param db DB ハンドル
 * @param cabinetId 内閣 ID
 * @param appointmentId 人事 ID
 * @returns 成功、または notFound
 */
export async function deleteAppointment(
  db: Db,
  cabinetId: number,
  appointmentId: number,
): Promise<CabinetWriteResult> {
  const deleted = await db
    .delete(cabinetAppointments)
    .where(
      and(eq(cabinetAppointments.id, appointmentId), eq(cabinetAppointments.cabinetId, cabinetId)),
    )
    .returning({ id: cabinetAppointments.id });
  return deleted.length > 0 ? { ok: true, id: appointmentId } : { ok: false, reason: "notFound" };
}
