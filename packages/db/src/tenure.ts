/** 在任期間。日付は「YYYY-MM-DD」。end が null なら期間の終わりがない（現在も在任）。 */
export interface Tenure {
  start: string;
  end: string | null;
}

/**
 * 人事の日付が空欄なら内閣の期間で補って、実際の在任期間にする。
 * @param row 人事の就任日・退任日（null は空欄）
 * @param cabinet 内閣の発足日・終了日
 * @returns 実際の在任期間
 */
export function resolveTenure(
  row: { startDate: string | null; endDate: string | null },
  cabinet: { startDate: string; endDate: string | null },
): Tenure {
  return { start: row.startDate ?? cabinet.startDate, end: row.endDate ?? cabinet.endDate };
}

/**
 * 2 つの在任期間が重なるかを調べる。
 * 退任日は「その日に次の人が就任してよい」日として扱う（初期データも、交代の日を前任の退任日・後任の就任日の両方に入れている）。
 * そのため、前任の退任日と後任の就任日が同じ日なら重ならない。同じ日に就任した 2 人は重なる。
 * @param a 期間 A
 * @param b 期間 B
 * @returns 重なれば true
 */
export function tenuresOverlap(a: Tenure, b: Tenure): boolean {
  if (a.start === b.start) return true;
  const aStartsBeforeBEnds = b.end === null || a.start < b.end;
  const bStartsBeforeAEnds = a.end === null || b.start < a.end;
  return aStartsBeforeBEnds && bStartsBeforeAEnds;
}
