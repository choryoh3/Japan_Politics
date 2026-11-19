/** 閣僚の役職 1 件分。 */
export interface CabinetPost {
  /** 役職名（名簿に表示する名前。初期データの表記と同じ） */
  name: string;
  /**
   * 単独の役職か。true なら、同じ内閣で在任期間が重なる人事を登録できない。
   * false（特命担当の国務大臣）は、複数人が同時に就ける。
   */
  solo: boolean;
}

/**
 * 管理者が選べる閣僚の役職。初期データで用意したものだけで、並びは名簿の標準の表示順。
 * 役職を自由に入力させないのは、表記ゆれ（「官房長官」と「内閣官房長官」など）で
 * 在任期間の重なりの検査をすり抜けられないようにするため。
 */
export const CABINET_POSTS: readonly CabinetPost[] = [
  { name: "内閣総理大臣", solo: true },
  { name: "内閣官房長官", solo: true },
  { name: "総務大臣", solo: true },
  { name: "法務大臣", solo: true },
  { name: "外務大臣", solo: true },
  { name: "財務大臣", solo: true },
  { name: "文部科学大臣", solo: true },
  { name: "厚生労働大臣", solo: true },
  { name: "農林水産大臣", solo: true },
  { name: "経済産業大臣", solo: true },
  { name: "国土交通大臣", solo: true },
  { name: "環境大臣", solo: true },
  { name: "防衛大臣", solo: true },
  { name: "デジタル大臣", solo: true },
  { name: "復興大臣", solo: true },
  { name: "国家公安委員会委員長", solo: true },
  { name: "経済再生担当大臣", solo: true },
  // 以下は特命担当の国務大臣。複数人が同時に就くことがあるので重なりを許す
  { name: "行政改革担当大臣", solo: false },
  { name: "経済安全保障担当大臣", solo: false },
  { name: "少子化対策担当大臣", solo: false },
];

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
