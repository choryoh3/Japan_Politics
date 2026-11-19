/** 日付の年・月・日（表示用に文字列で持つ）。 */
export type DateParts = { year: string; month: string; day: string };

/**
 * 「YYYY-MM-DD」を年・月・日に分ける。月日の 0 埋めは外す（例: 09 → 9）。
 * 数値ではなく文字列で返すのは、表示時に桁区切り（2,020）が入るのを避けるため。
 * @param iso 「YYYY-MM-DD」形式の日付
 * @returns 年・月・日。形式が不正なら null
 */
export function parseIsoDate(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: match[1]!, month: String(Number(match[2])), day: String(Number(match[3])) };
}
