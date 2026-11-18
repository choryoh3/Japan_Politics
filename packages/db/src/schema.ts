import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/** 人物テーブル。実在の政治家の氏名とよみがな（ひらがな）を持つ。 */
export const persons = sqliteTable("persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** 氏名（同姓同名はこのスプリントの範囲では存在しないので一意とする） */
  name: text("name").notNull().unique(),
  /** よみがな（ひらがな） */
  kana: text("kana").notNull(),
});

/** 内閣テーブル。日付は「YYYY-MM-DD」の文字列で持つ。終了日が null なら現在の内閣。 */
export const cabinets = sqliteTable("cabinets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** 内閣名（首相官邸の表記） */
  name: text("name").notNull().unique(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
});

/** 閣僚人事テーブル。1行が「ある内閣のある役職に、ある人物が就いた」記録。 */
export const cabinetAppointments = sqliteTable(
  "cabinet_appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cabinetId: integer("cabinet_id")
      .notNull()
      .references(() => cabinets.id),
    personId: integer("person_id")
      .notNull()
      .references(() => persons.id),
    /** 役職名（例: 内閣官房長官） */
    postName: text("post_name").notNull(),
    /** 名簿での表示順（小さいほど上） */
    sortOrder: integer("sort_order").notNull(),
    /** 在任開始日。null なら内閣の発足日から */
    startDate: text("start_date"),
    /** 在任終了日。null なら内閣の終了まで（在任途中の交代があるときだけ入る） */
    endDate: text("end_date"),
    /** 出典 URL */
    sourceUrl: text("source_url").notNull(),
    /** 出典メモ（どこを根拠にしたか、確認の状況） */
    sourceNote: text("source_note").notNull(),
  },
  (t) => [
    unique("cabinet_appointments_unique").on(t.cabinetId, t.postName, t.personId),
    index("cabinet_appointments_cabinet_idx").on(t.cabinetId, t.sortOrder),
  ],
);
