/**
 * スクレイピング由来の試合ID（"game-<連番>"、現状 game-140 まで）と名前空間が
 * 絶対に衝突しないよう、フォーム経由で作成する試合は日付ベースのIDにする。
 * 同日に複数試合（ダブルヘッダー等）があった場合のみ -2, -3 ... を付与する。
 */
export function nextGameId(date: string, existingIdsForDate: string[]): string {
  const compact = date.replaceAll("-", "");
  const base = `game-${compact}`;

  if (!existingIdsForDate.includes(base)) return base;

  let n = 2;
  while (existingIdsForDate.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
