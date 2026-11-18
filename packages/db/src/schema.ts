import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/** 人物テーブル。実在の政治家の氏名とよみがな（ひらがな）を持つ。 */
export const persons = sqliteTable("persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** 氏名（同姓同名はこのスプリントの範囲では存在しないので一意とする） */
  name: text("name").notNull().unique(),
  /** よみがな（ひらがな） */
  kana: text("kana").notNull(),
  /** 生年月日（「YYYY-MM-DD」。任意） */
  birthDate: text("birth_date"),
  /** メモ（任意） */
  memo: text("memo"),
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

// ---- 認証（Better Auth）のテーブル。列の形は Better Auth の標準に合わせる ----

/** ユーザーテーブル。role は "user"（一般）か "admin"（管理者）。登録時は必ず "user"。 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  /** 表示名 */
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  /** 権限。管理者への変更は付与コマンドだけが行う */
  role: text("role").notNull().default("user"),
});

/** ログインセッションのテーブル。 */
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

/** 認証方法（メールとパスワードなど）のテーブル。パスワードはハッシュ化されて入る。 */
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

/** 確認用トークンのテーブル（このスプリントでは使わないが Better Auth が必要とする）。 */
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
