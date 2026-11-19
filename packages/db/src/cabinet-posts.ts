/** 役職の区分。内閣詳細の 4 つの見出しと対応する（この並びが画面の並び）。 */
export const POST_CATEGORIES = [
  "minister",
  "deputyChiefSecretary",
  "viceMinister",
  "parliamentaryVice",
] as const;

/** 役職の区分の型。minister=閣僚、deputyChiefSecretary=内閣官房副長官、viceMinister=副大臣、parliamentaryVice=大臣政務官。 */
export type PostCategory = (typeof POST_CATEGORIES)[number];

/** 府省 1 件分。 */
export interface Ministry {
  /** 府省名（例: 財務省） */
  name: string;
  /** 役職名に使う略称（例: 財務。「省」「庁」を除いた形） */
  shortName: string;
}

/**
 * 現行の府省 14 件。並びは省庁一覧の表示順。
 * 内閣府・デジタル庁・復興庁と、11 省。2001 年の再編より前の旧省庁は扱わない。
 */
export const MINISTRIES: readonly Ministry[] = [
  { name: "内閣府", shortName: "内閣府" },
  { name: "デジタル庁", shortName: "デジタル" },
  { name: "復興庁", shortName: "復興" },
  { name: "総務省", shortName: "総務" },
  { name: "法務省", shortName: "法務" },
  { name: "外務省", shortName: "外務" },
  { name: "財務省", shortName: "財務" },
  { name: "文部科学省", shortName: "文部科学" },
  { name: "厚生労働省", shortName: "厚生労働" },
  { name: "農林水産省", shortName: "農林水産" },
  { name: "経済産業省", shortName: "経済産業" },
  { name: "国土交通省", shortName: "国土交通" },
  { name: "環境省", shortName: "環境" },
  { name: "防衛省", shortName: "防衛" },
];

/** 役職 1 件分。 */
export interface CabinetPost {
  /** 役職名（名簿に表示する名前。初期データの表記と同じ） */
  name: string;
  /**
   * 単独の役職か。true なら、同じ内閣で在任期間が重なる人事を登録できない。
   * false（特命担当の国務大臣・内閣官房副長官・副大臣・大臣政務官）は、複数人が同時に就ける。
   */
  solo: boolean;
  /** 役職の区分 */
  category: PostCategory;
  /** 担当の府省名（大臣・副大臣・大臣政務官のとき。内閣総理大臣・内閣官房長官・内閣官房副長官は null） */
  ministry: string | null;
}

/**
 * 閣僚の役職。[役職名, 単独か, 担当の府省名] の並びで、名簿の標準の表示順。
 * 担当の府省は、省庁ページの「大臣」タブに載せる役職を決めるために使う。
 * 内閣府には、国家公安委員会委員長と、内閣府の特命担当（経済再生・行政改革・経済安全保障・少子化対策）を置く。
 */
const MINISTER_POSTS: readonly (readonly [string, boolean, string | null])[] = [
  ["内閣総理大臣", true, null],
  ["内閣官房長官", true, null],
  ["総務大臣", true, "総務省"],
  ["法務大臣", true, "法務省"],
  ["外務大臣", true, "外務省"],
  ["財務大臣", true, "財務省"],
  ["文部科学大臣", true, "文部科学省"],
  ["厚生労働大臣", true, "厚生労働省"],
  ["農林水産大臣", true, "農林水産省"],
  ["経済産業大臣", true, "経済産業省"],
  ["国土交通大臣", true, "国土交通省"],
  ["環境大臣", true, "環境省"],
  ["防衛大臣", true, "防衛省"],
  ["デジタル大臣", true, "デジタル庁"],
  ["復興大臣", true, "復興庁"],
  ["国家公安委員会委員長", true, "内閣府"],
  ["経済再生担当大臣", true, "内閣府"],
  // 以下は特命担当の国務大臣。複数人が同時に就くことがあるので重なりを許す
  ["行政改革担当大臣", false, "内閣府"],
  ["経済安全保障担当大臣", false, "内閣府"],
  ["少子化対策担当大臣", false, "内閣府"],
];

/** 内閣官房副長官の役職名。3 人が同時に就くので重なりを許す。 */
export const DEPUTY_CHIEF_SECRETARY_POST = "内閣官房副長官";

/**
 * 管理者が選べる役職。初期データで用意したものだけで、並びは名簿の標準の表示順
 * （閣僚 → 内閣官房副長官 → 副大臣 → 大臣政務官）。
 * 役職を自由に入力させないのは、表記ゆれ（「官房長官」と「内閣官房長官」など）で
 * 在任期間の重なりの検査をすり抜けられないようにするため。
 * 副大臣・大臣政務官は「府省の略称＋副大臣／大臣政務官」（例: 財務副大臣）。
 */
export const CABINET_POSTS: readonly CabinetPost[] = [
  ...MINISTER_POSTS.map(([name, solo, ministry]): CabinetPost => ({
    name,
    solo,
    category: "minister",
    ministry,
  })),
  {
    name: DEPUTY_CHIEF_SECRETARY_POST,
    solo: false,
    category: "deputyChiefSecretary",
    ministry: null,
  },
  ...MINISTRIES.map((m): CabinetPost => ({
    name: `${m.shortName}副大臣`,
    solo: false,
    category: "viceMinister",
    ministry: m.name,
  })),
  ...MINISTRIES.map((m): CabinetPost => ({
    name: `${m.shortName}大臣政務官`,
    solo: false,
    category: "parliamentaryVice",
    ministry: m.name,
  })),
];

/**
 * 役職の区分を調べる。一覧にない役職名は、閣僚として扱う（Sprint 4 までの人事を壊さないため）。
 * @param name 役職名
 * @returns 役職の区分
 */
export function postCategory(name: string): PostCategory {
  return CABINET_POSTS.find((post) => post.name === name)?.category ?? "minister";
}

/**
 * ある府省の、ある区分の役職名を返す（省庁ページのタブの中身を決める）。
 * @param ministry 府省名（例: 財務省）
 * @param category 役職の区分
 * @returns 役職名の一覧
 */
export function postNamesForMinistry(ministry: string, category: PostCategory): string[] {
  return CABINET_POSTS.filter((p) => p.category === category && p.ministry === ministry).map(
    (p) => p.name,
  );
}

/**
 * 役職名が選べる役職かを調べる。
 * @param name 役職名
 * @returns 選べる役職なら true
 */
export function isCabinetPost(name: string): boolean {
  return CABINET_POSTS.some((post) => post.name === name);
}

/**
 * 役職が単独の役職か（在任期間の重なりを禁止するか）を調べる。
 * 一覧にない役職名は、安全側（重なりを禁止）として単独扱いにする。
 * @param name 役職名
 * @returns 単独の役職なら true
 */
export function isSoloPost(name: string): boolean {
  return CABINET_POSTS.find((post) => post.name === name)?.solo ?? true;
}

/**
 * 名簿の標準の並びでの順位（小さいほど上）。一覧にない役職は末尾扱い。
 * @param name 役職名
 * @returns 順位
 */
export function postRank(name: string): number {
  const index = CABINET_POSTS.findIndex((post) => post.name === name);
  return index === -1 ? CABINET_POSTS.length : index;
}
