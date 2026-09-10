/**
 * "<prefix>-YYYYMMDD[-n]" 形式のIDを生成する。日付ベースにすることで、
 * スクレイピング由来の連番ID（例: game-140）と名前空間が絶対に衝突しない。
 * 同日に複数件（ダブルヘッダー等）ある場合のみ -2, -3 ... を付与する。
 */
export function nextIdForDate(prefix: string, date: string, existingIds: string[]): string {
  const compact = date.replaceAll("-", "");
  const base = `${prefix}-${compact}`;

  if (!existingIds.includes(base)) return base;

  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
