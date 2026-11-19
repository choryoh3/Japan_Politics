import { fileURLToPath } from "node:url";
import { createDb, type Db } from "./client.ts";
import { cabinetSeeds, DEPUTY_SOURCE_NOTE, SOURCE_NOTE, type RosterEntry } from "./cabinet-data.ts";
import { MINISTRIES } from "./cabinet-posts.ts";
import { cabinetAppointments, cabinets, ministries, persons } from "./schema.ts";

/**
 * 初期データを DB に投入する。何度実行しても件数が増えないよう、
 * 一意な項目（内閣名・氏名・内閣+役職+人物）が重複したら上書きにする。
 * 既存データを消すことはしない。
 * @param db DB ハンドル
 */
export async function seedInitialData(db: Db): Promise<void> {
  await seedMinistries(db);
  for (const seed of cabinetSeeds) {
    await db
      .insert(cabinets)
      .values({ name: seed.name, startDate: seed.startDate, endDate: seed.endDate })
      .onConflictDoUpdate({
        target: cabinets.name,
        set: { startDate: seed.startDate, endDate: seed.endDate },
      });
    const cabinet = await db.query.cabinets.findFirst({
      where: (c, { eq }) => eq(c.name, seed.name),
    });
    if (!cabinet) throw new Error(`内閣を登録できませんでした: ${seed.name}`);

    await seedAppointments(db, cabinet.id, seed.roster, 0, seed.sourceUrl, SOURCE_NOTE);
    // 副長官・副大臣・政務官は、閣僚の次の表示順から並べる
    await seedAppointments(
      db,
      cabinet.id,
      seed.deputies ?? [],
      seed.roster.length,
      seed.sourceUrl,
      DEPUTY_SOURCE_NOTE,
    );
  }
}

/**
 * 府省 14 件を投入する。名前が同じなら表示順だけ更新する（既存の ID は変わらない）。
 * @param db DB ハンドル
 */
async function seedMinistries(db: Db): Promise<void> {
  for (const [index, ministry] of MINISTRIES.entries()) {
    await db
      .insert(ministries)
      .values({ name: ministry.name, sortOrder: index })
      .onConflictDoUpdate({ target: ministries.name, set: { sortOrder: index } });
  }
}

/**
 * 1 つの内閣に、人事の一覧（人物も未登録なら一緒に）を投入する。
 * @param db DB ハンドル
 * @param cabinetId 内閣 ID
 * @param entries 人事の一覧
 * @param firstSortOrder 先頭の行の表示順
 * @param sourceUrl 出典 URL
 * @param sourceNote 出典メモ
 */
async function seedAppointments(
  db: Db,
  cabinetId: number,
  entries: readonly RosterEntry[],
  firstSortOrder: number,
  sourceUrl: string,
  sourceNote: string,
): Promise<void> {
  for (const [offset, [post, name, kana, startDate, endDate]] of entries.entries()) {
    const sortOrder = firstSortOrder + offset;
    await db
      .insert(persons)
      .values({ name, kana })
      .onConflictDoUpdate({ target: persons.name, set: { kana } });
    const person = await db.query.persons.findFirst({
      where: (p, { eq }) => eq(p.name, name),
    });
    if (!person) throw new Error(`人物を登録できませんでした: ${name}`);

    await db
      .insert(cabinetAppointments)
      .values({
        cabinetId,
        personId: person.id,
        postName: post,
        sortOrder,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        sourceUrl,
        sourceNote,
      })
      .onConflictDoUpdate({
        target: [
          cabinetAppointments.cabinetId,
          cabinetAppointments.postName,
          cabinetAppointments.personId,
        ],
        set: {
          sortOrder,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          sourceUrl,
          sourceNote,
        },
      });
  }
}

// コマンド（pnpm db:seed）として直接実行されたときだけ動かす
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await seedInitialData(createDb());
  console.log(`初期データを投入しました（内閣 ${cabinetSeeds.length} 件）`);
}
