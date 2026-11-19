import { eq, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import type { PersonInput } from "./person-input.ts";
import { cabinetAppointments, persons, user } from "./schema.ts";

/** 人物の書き込みの結果。失敗の理由はコードで返す。 */
export type PersonWriteResult =
  { ok: true; id: number } | { ok: false; reason: "duplicate" | "notFound" | "hasCareers" };

/**
 * 一意制約（氏名の重複）違反のエラーかを調べる。
 * @param error 捕まえたエラー
 * @returns 重複エラーなら true
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  // libSQL のエラーは原因が cause に入れ子になっていることがあるので辿る
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (/UNIQUE constraint failed/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

/**
 * 人物を追加する。
 * @param db DB ハンドル
 * @param input 検証済みの入力
 * @returns 追加した人物の ID。同じ氏名が既にあれば duplicate
 */
export async function createPerson(db: Db, input: PersonInput): Promise<PersonWriteResult> {
  try {
    const [row] = await db
      .insert(persons)
      .values({
        name: input.name,
        kana: input.kana,
        birthDate: input.birthDate,
        memo: input.memo,
      })
      .returning({ id: persons.id });
    return { ok: true, id: row!.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

/**
 * 人物を修正する。
 * @param db DB ハンドル
 * @param id 人物 ID
 * @param input 検証済みの入力
 * @returns 成功、または notFound / duplicate
 */
export async function updatePerson(
  db: Db,
  id: number,
  input: PersonInput,
): Promise<PersonWriteResult> {
  try {
    const rows = await db
      .update(persons)
      .set({
        name: input.name,
        kana: input.kana,
        birthDate: input.birthDate,
        memo: input.memo,
      })
      .where(eq(persons.id, id))
      .returning({ id: persons.id });
    if (rows.length === 0) return { ok: false, reason: "notFound" };
    return { ok: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }
}

/**
 * 人物を削除する。経歴（閣僚人事）が 1 件でもある人物は削除しない。
 * 確認と削除を 1 回の SQL にして、確認後に経歴が増えるすき間をなくす。
 * @param db DB ハンドル
 * @param id 人物 ID
 * @returns 成功、または notFound / hasCareers
 */
export async function deletePerson(db: Db, id: number): Promise<PersonWriteResult> {
  const deleted = await db
    .delete(persons)
    .where(
      sql`${persons.id} = ${id} AND NOT EXISTS (SELECT 1 FROM ${cabinetAppointments} WHERE ${cabinetAppointments.personId} = ${id})`,
    )
    .returning({ id: persons.id });
  if (deleted.length > 0) return { ok: true, id };
  const [exists] = await db.select({ id: persons.id }).from(persons).where(eq(persons.id, id));
  return { ok: false, reason: exists ? "hasCareers" : "notFound" };
}

/** 管理者の付与の結果。 */
export type GrantAdminResult = { ok: true } | { ok: false; reason: "noAccount" };

/**
 * メールアドレスのアカウントを管理者にする（既に管理者でも成功）。
 * Better Auth はメールアドレスを小文字で保存するので、小文字にそろえて探す。
 * @param db DB ハンドル
 * @param email 対象のメールアドレス
 * @returns 成功、または該当アカウントなし
 */
export async function grantAdmin(db: Db, email: string): Promise<GrantAdminResult> {
  const rows = await db
    .update(user)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(user.email, email.trim().toLowerCase()))
    .returning({ id: user.id });
  return rows.length > 0 ? { ok: true } : { ok: false, reason: "noAccount" };
}
