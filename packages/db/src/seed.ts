import { fileURLToPath } from "node:url";
import { createDb, type Db } from "./client.ts";
import { cabinetSeeds, SOURCE_NOTE } from "./cabinet-data.ts";
import { cabinetAppointments, cabinets, persons } from "./schema.ts";

/**
 * 初期データを DB に投入する。何度実行しても件数が増えないよう、
 * 一意な項目（内閣名・氏名・内閣+役職+人物）が重複したら上書きにする。
 * 既存データを消すことはしない。
 * @param db DB ハンドル
 */
export async function seedInitialData(db: Db): Promise<void> {
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

    for (const [index, [post, name, kana, startDate, endDate]] of seed.roster.entries()) {
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
          cabinetId: cabinet.id,
          personId: person.id,
          postName: post,
          sortOrder: index,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          sourceUrl: seed.sourceUrl,
          sourceNote: SOURCE_NOTE,
        })
        .onConflictDoUpdate({
          target: [
            cabinetAppointments.cabinetId,
            cabinetAppointments.postName,
            cabinetAppointments.personId,
          ],
          set: {
            sortOrder: index,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            sourceUrl: seed.sourceUrl,
            sourceNote: SOURCE_NOTE,
          },
        });
    }
  }
}

// コマンド（pnpm db:seed）として直接実行されたときだけ動かす
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await seedInitialData(createDb());
  console.log(`初期データを投入しました（内閣 ${cabinetSeeds.length} 件）`);
}
