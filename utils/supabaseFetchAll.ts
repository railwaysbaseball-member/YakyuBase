type SupabaseQueryResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * PostgRESTはデフォルトで1件のクエリにつき最大1000件までしか返さない。
 * フィルタ無しの全件取得（試合数・打席数のように時間経過で増え続けるテーブル）は
 * いずれこの上限を超え、黙って後半の行が切り捨てられる（実際に
 * game_batting_stats が1000件を超えて /stats の集計がズレた実例あり）。
 * .range(from, to) を末尾に付けたクエリを返す関数を渡すことで、
 * 上限を超えても全件を取り切るまでページングする。
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<SupabaseQueryResult<T>>
): Promise<SupabaseQueryResult<T>> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
