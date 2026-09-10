import Link from "next/link";
import { Fragment } from "react";

import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import { calcPitching, formatInnings } from "@/lib/pitching/calcPitchingStats";
import { calcFielding } from "@/lib/fielding/calcFieldingStats";
import { calcBatterPoint, calcPitcherPoint } from "@/lib/points/calcPoints";
import { formatAvg, formatRate } from "@/lib/format";
import type { PlateResult } from "@/types/plateResult";
import type { PitchingStats } from "@/types/pitching";
import type { FieldingStats } from "@/types/fielding";
import type { SeasonParameters } from "@/types/seasonParameters";

type PageProps = {
  searchParams: Promise<{ season?: string; sort?: string; dir?: string }>;
};

type BattingResultRow = {
  player: PlayerRow;
  games: number;
  calc: ReturnType<typeof calcBatting>;
  point: number | null;
  qualified: boolean;
};

const BATTING_SORT_COLUMNS: {
  key: string;
  label: string;
  defaultDir: "asc" | "desc";
  getValue: (r: BattingResultRow) => number | string;
}[] = [
  { key: "name", label: "選手", defaultDir: "asc", getValue: (r) => r.player.name },
  { key: "games", label: "試合", defaultDir: "desc", getValue: (r) => r.games },
  { key: "pa", label: "打席", defaultDir: "desc", getValue: (r) => r.calc.pa },
  { key: "ab", label: "打数", defaultDir: "desc", getValue: (r) => r.calc.ab },
  { key: "hits", label: "安打", defaultDir: "desc", getValue: (r) => r.calc.hits },
  { key: "hr", label: "本塁打", defaultDir: "desc", getValue: (r) => r.calc.homeruns },
  { key: "rbi", label: "打点", defaultDir: "desc", getValue: (r) => r.calc.rbi },
  { key: "steals", label: "盗塁", defaultDir: "desc", getValue: (r) => r.calc.steals },
  { key: "avg", label: "打率", defaultDir: "desc", getValue: (r) => r.calc.avg },
  { key: "obp", label: "出塁率", defaultDir: "desc", getValue: (r) => r.calc.obp },
  { key: "slg", label: "長打率", defaultDir: "desc", getValue: (r) => r.calc.slg },
  { key: "ops", label: "OPS", defaultDir: "desc", getValue: (r) => r.calc.ops },
  { key: "risp", label: "得点圏", defaultDir: "desc", getValue: (r) => r.calc.risp_avg },
  { key: "rc27", label: "RC27", defaultDir: "desc", getValue: (r) => r.calc.rc27 },
  { key: "point", label: "POINT", defaultDir: "desc", getValue: (r) => r.point ?? -Infinity },
];

type PlayerRow = {
  id: string;
  name: string;
  number: number | null;
};

type GameRow = {
  id: string;
  date: string;
};

type BattingRow = {
  player_id: string;
  game_id: string;
  plate_results: PlateResult[] | null;
};

export default async function StatsPage({ searchParams }: PageProps) {
  const { season: seasonParam, sort: sortParam, dir: dirParam } = await searchParams;

  const [
    { data: players, error: playersError },
    { data: games, error: gamesError },
    { data: battingRows, error: battingError },
    { data: pitchingRows, error: pitchingError },
    { data: fieldingRows, error: fieldingError },
    { data: seasonParamsRows, error: seasonParamsError },
  ] = await Promise.all([
    fetchAllRows<PlayerRow>((from, to) =>
      supabase.from("players").select("id, name, number").range(from, to)
    ),
    fetchAllRows<GameRow>((from, to) => supabase.from("games").select("id, date").range(from, to)),
    fetchAllRows<BattingRow>((from, to) =>
      supabase.from("game_batting_stats").select("player_id, game_id, plate_results").range(from, to)
    ),
    fetchAllRows<PitchingStats>((from, to) =>
      supabase.from("game_pitching_stats").select("*").range(from, to)
    ),
    fetchAllRows<FieldingStats>((from, to) =>
      supabase.from("game_fielding_stats").select("*").range(from, to)
    ),
    supabase.from("season_parameters").select("*"),
  ]);

  if (playersError || gamesError || battingError || pitchingError) {
    console.error(playersError, gamesError, battingError, pitchingError);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  // game_fielding_stats は Supabase 側のGRANT設定（supabase/migrations/0001）が
  // 未適用だと anon から読めず 401 になる。守備成績だけは無くても他のセクションは
  // 表示したいので、失敗してもページ全体は落とさず空データとして扱う。
  if (fieldingError) {
    console.error("game_fielding_stats fetch failed (0001マイグレーション未適用の可能性):", fieldingError);
  }

  // season_parameters（POINT計算・規定打席/投球回の重み付け）が未投入でもページは
  // 表示したいので、失敗時は null のまま扱い規定判定・POINT列は "-" 表示にする。
  if (seasonParamsError) {
    console.error("season_parameters fetch failed:", seasonParamsError);
  }

  const gameList = (games ?? []) as GameRow[];
  const seasonYears = Array.from(new Set(gameList.map((g) => g.date.slice(0, 4)))).sort(
    (a, b) => Number(b) - Number(a)
  );
  const selectedSeason =
    seasonParam && (seasonParam === "all" || seasonYears.includes(seasonParam))
      ? seasonParam
      : (seasonYears[0] ?? "all");

  const gameIdsInScope =
    selectedSeason === "all"
      ? null
      : new Set(gameList.filter((g) => g.date.slice(0, 4) === selectedSeason).map((g) => g.id));
  const teamGames = gameIdsInScope ? gameIdsInScope.size : gameList.length;
  const inScope = (gameId: string) => gameIdsInScope === null || gameIdsInScope.has(gameId);

  const seasonParamsList = (seasonParamsRows ?? []) as SeasonParameters[];
  const seasonParams =
    (selectedSeason !== "all"
      ? seasonParamsList.find((p) => p.season === Number(selectedSeason))
      : undefined) ?? seasonParamsList.find((p) => p.season === 0) ?? null;

  // 規定打席・規定投球回 = 実際の試合数 × season_parameters の倍率を切り上げ。
  const requiredPa =
    seasonParams?.required_pa != null ? Math.ceil(teamGames * seasonParams.required_pa) : null;
  const requiredIp =
    seasonParams?.required_ip != null ? Math.ceil(teamGames * seasonParams.required_ip) : null;

  const battingByPlayer = new Map<string, BattingRow[]>();
  for (const row of (battingRows ?? []) as BattingRow[]) {
    if (!inScope(row.game_id)) continue;
    const list = battingByPlayer.get(row.player_id) ?? [];
    list.push(row);
    battingByPlayer.set(row.player_id, list);
  }

  const pitchingByPlayer = new Map<string, PitchingStats[]>();
  for (const row of (pitchingRows ?? []) as PitchingStats[]) {
    if (!inScope(row.game_id)) continue;
    const list = pitchingByPlayer.get(row.player_id) ?? [];
    list.push(row);
    pitchingByPlayer.set(row.player_id, list);
  }

  const fieldingByPlayer = new Map<string, FieldingStats[]>();
  for (const row of (fieldingRows ?? []) as FieldingStats[]) {
    if (!inScope(row.game_id)) continue;
    const list = fieldingByPlayer.get(row.player_id) ?? [];
    list.push(row);
    fieldingByPlayer.set(row.player_id, list);
  }

  const playerList = ((players ?? []) as PlayerRow[]).slice().sort((a, b) => {
    if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
    if (a.number == null) return 1;
    if (b.number == null) return -1;
    return a.number - b.number;
  });

  const battingResultsBase: BattingResultRow[] = playerList
    .map((player) => {
      const rows = battingByPlayer.get(player.id) ?? [];
      if (rows.length === 0) return null;

      const gamesPlayed = new Set(rows.map((r) => r.game_id)).size;
      const plateResults = rows.flatMap((r) => r.plate_results ?? []);
      const calc = calcBatting(plateResults);
      const fielding = calcFielding(fieldingByPlayer.get(player.id) ?? []);
      const point = seasonParams ? calcBatterPoint(calc, fielding, seasonParams) : null;
      const qualified = requiredPa != null && calc.pa >= requiredPa;

      return { player, games: gamesPlayed, calc, point, qualified };
    })
    .filter((v): v is BattingResultRow => v !== null);

  // ヘッダークリックで並び替えが指定されていれば、そちらを優先する（規定打席グループ分けは無視）。
  // 指定が無ければ従来通り「規定打席以上を上に、打率降順」がデフォルト。
  const battingSortColumn = BATTING_SORT_COLUMNS.find((c) => c.key === sortParam) ?? null;
  const battingSortDir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc";

  const battingResults = battingSortColumn
    ? [...battingResultsBase].sort((a, b) => {
        const va = battingSortColumn.getValue(a);
        const vb = battingSortColumn.getValue(b);
        const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
        return battingSortDir === "asc" ? cmp : -cmp;
      })
    : [...battingResultsBase].sort((a, b) => {
        if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
        return b.calc.avg - a.calc.avg;
      });
  const battingQualifiedCount = battingSortColumn ? 0 : battingResults.filter((r) => r.qualified).length;

  function battingSortHref(col: (typeof BATTING_SORT_COLUMNS)[number]): string {
    const nextDir =
      battingSortColumn?.key === col.key ? (battingSortDir === "asc" ? "desc" : "asc") : col.defaultDir;
    const params = new URLSearchParams();
    params.set("season", selectedSeason);
    params.set("sort", col.key);
    params.set("dir", nextDir);
    return `/stats?${params.toString()}`;
  }

  const pitchingResults = playerList
    .map((player) => {
      const rows = pitchingByPlayer.get(player.id) ?? [];
      if (rows.length === 0) return null;

      const calc = calcPitching(rows, {
        qsMinInnings: seasonParams?.qs ?? undefined,
        qsMaxEarnedRuns: seasonParams?.earned_runs ?? undefined,
      });
      const point = seasonParams ? calcPitcherPoint(calc, seasonParams) : null;
      const qualified = requiredIp != null && calc.inningsReal >= requiredIp;

      return { player, calc, point, qualified };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      return a.calc.era - b.calc.era;
    });
  const pitchingQualifiedCount = pitchingResults.filter((r) => r.qualified).length;

  const fieldingResults = playerList
    .map((player) => {
      const rows = fieldingByPlayer.get(player.id) ?? [];
      if (rows.length === 0) return null;

      const calc = calcFielding(rows);
      return { player, calc };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.calc.chances - a.calc.chances);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">個人成績</h1>
        <nav className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/stats?season=all"
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selectedSeason === "all"
                ? "bg-team-red text-white"
                : "bg-surface-muted text-foreground/70 hover:bg-border-subtle"
            }`}
          >
            全期間
          </Link>
          {seasonYears.map((year) => (
            <Link
              key={year}
              href={`/stats?season=${year}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedSeason === year
                  ? "bg-team-red text-white"
                  : "bg-surface-muted text-foreground/70 hover:bg-border-subtle"
              }`}
            >
              {year}年
            </Link>
          ))}
        </nav>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">打撃成績</h2>
          <span className="text-xs text-foreground/50">
            規定打席: {requiredPa ?? "-"}打席以上（{teamGames}試合）
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-right text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                {BATTING_SORT_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 font-medium text-foreground/50 ${col.key === "name" ? "text-left" : ""}`}
                  >
                    <Link
                      href={battingSortHref(col)}
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                    >
                      {col.label}
                      {battingSortColumn?.key === col.key && (
                        <span className="text-team-red">{battingSortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {battingResults.map(({ player, games: gamesPlayed, calc, point, qualified }, i) => (
                <Fragment key={player.id}>
                  {i === battingQualifiedCount && battingQualifiedCount > 0 && (
                    <tr key="divider">
                      <td colSpan={15} className="border-t border-border-subtle bg-surface-muted px-3 py-1 text-left text-xs text-foreground/50">
                        規定打席未満
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-border-subtle ${qualified ? "" : "text-foreground/50"}`}>
                    <td className="px-3 py-2 text-left font-medium">{player.name}</td>
                    <td className="px-3 py-2">{gamesPlayed}</td>
                    <td className="px-3 py-2">{calc.pa}</td>
                    <td className="px-3 py-2">{calc.ab}</td>
                    <td className="px-3 py-2">{calc.hits}</td>
                    <td className="px-3 py-2">{calc.homeruns}</td>
                    <td className="px-3 py-2">{calc.rbi}</td>
                    <td className="px-3 py-2">{calc.steals}</td>
                    <td className="px-3 py-2">{formatAvg(calc.avg)}</td>
                    <td className="px-3 py-2">{formatAvg(calc.obp)}</td>
                    <td className="px-3 py-2">{formatAvg(calc.slg)}</td>
                    <td className="px-3 py-2">{formatAvg(calc.ops)}</td>
                    <td className="px-3 py-2">{formatAvg(calc.risp_avg)}</td>
                    <td className="px-3 py-2">{calc.rc27.toFixed(2)}</td>
                    <td className="px-3 py-2">{point ?? "-"}</td>
                  </tr>
                </Fragment>
              ))}
              {battingResults.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-foreground/50">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">投手成績</h2>
          <span className="text-xs text-foreground/50">
            規定投球回: {requiredIp ?? "-"}回以上（{teamGames}試合）
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-right text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground/50">選手</th>
                <th className="px-3 py-2 font-medium text-foreground/50">試合</th>
                <th className="px-3 py-2 font-medium text-foreground/50">先発</th>
                <th className="px-3 py-2 font-medium text-foreground/50">勝</th>
                <th className="px-3 py-2 font-medium text-foreground/50">負</th>
                <th className="px-3 py-2 font-medium text-foreground/50">Ｓ</th>
                <th className="px-3 py-2 font-medium text-foreground/50">Ｈ</th>
                <th className="px-3 py-2 font-medium text-foreground/50">投球回</th>
                <th className="px-3 py-2 font-medium text-foreground/50">防御率</th>
                <th className="px-3 py-2 font-medium text-foreground/50">失点率</th>
                <th className="px-3 py-2 font-medium text-foreground/50">奪三振</th>
                <th className="px-3 py-2 font-medium text-foreground/50">奪三振率</th>
                <th className="px-3 py-2 font-medium text-foreground/50">与四死球率</th>
                <th className="px-3 py-2 font-medium text-foreground/50">WHIP</th>
                <th className="px-3 py-2 font-medium text-foreground/50">QS</th>
                <th className="px-3 py-2 font-medium text-foreground/50">QS率</th>
                <th className="px-3 py-2 font-medium text-foreground/50">POINT</th>
              </tr>
            </thead>
            <tbody>
              {pitchingResults.map(({ player, calc, point, qualified }, i) => (
                <Fragment key={player.id}>
                  {i === pitchingQualifiedCount && pitchingQualifiedCount > 0 && (
                    <tr key="divider">
                      <td colSpan={17} className="border-t border-border-subtle bg-surface-muted px-3 py-1 text-left text-xs text-foreground/50">
                        規定投球回未満
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-border-subtle ${qualified ? "" : "text-foreground/50"}`}>
                    <td className="px-3 py-2 text-left font-medium">{player.name}</td>
                    <td className="px-3 py-2">{calc.games}</td>
                    <td className="px-3 py-2">{calc.starts}</td>
                    <td className="px-3 py-2">{calc.wins}</td>
                    <td className="px-3 py-2">{calc.losses}</td>
                    <td className="px-3 py-2">{calc.saves}</td>
                    <td className="px-3 py-2">{calc.holds}</td>
                    <td className="px-3 py-2">{formatInnings(calc.outs)}</td>
                    <td className="px-3 py-2">{formatRate(calc.era)}</td>
                    <td className="px-3 py-2">{formatRate(calc.ra)}</td>
                    <td className="px-3 py-2">{calc.strikeouts}</td>
                    <td className="px-3 py-2">{formatRate(calc.kRate)}</td>
                    <td className="px-3 py-2">{formatRate(calc.bbHbpRate)}</td>
                    <td className="px-3 py-2">{formatRate(calc.whip)}</td>
                    <td className="px-3 py-2">{calc.qs}</td>
                    <td className="px-3 py-2">
                      {calc.starts > 0 ? `${calc.qsRate.toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-3 py-2">{point ?? "-"}</td>
                  </tr>
                </Fragment>
              ))}
              {pitchingResults.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-3 py-6 text-center text-foreground/50">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">守備成績</h2>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-right text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground/50">選手</th>
                <th className="px-3 py-2 font-medium text-foreground/50">試合</th>
                <th className="px-3 py-2 font-medium text-foreground/50">刺殺</th>
                <th className="px-3 py-2 font-medium text-foreground/50">補殺</th>
                <th className="px-3 py-2 font-medium text-foreground/50">失策</th>
                <th className="px-3 py-2 font-medium text-foreground/50">美技</th>
                <th className="px-3 py-2 font-medium text-foreground/50">珍技</th>
                <th className="px-3 py-2 font-medium text-foreground/50">守備率</th>
              </tr>
            </thead>
            <tbody>
              {fieldingResults.map(({ player, calc }) => (
                <tr key={player.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2 text-left font-medium">{player.name}</td>
                  <td className="px-3 py-2">{calc.games}</td>
                  <td className="px-3 py-2">{calc.putout}</td>
                  <td className="px-3 py-2">{calc.assist}</td>
                  <td className="px-3 py-2">{calc.error}</td>
                  <td className="px-3 py-2">{calc.beauty}</td>
                  <td className="px-3 py-2">{calc.rarePlay}</td>
                  <td className="px-3 py-2">{formatAvg(calc.fieldingPct)}</td>
                </tr>
              ))}
              {fieldingResults.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-foreground/50">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
