import Link from "next/link";
import { Fragment } from "react";

import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import { calcPitching, formatInnings } from "@/lib/pitching/calcPitchingStats";
import { calcFielding } from "@/lib/fielding/calcFieldingStats";
import { calcBatterPoint, calcPitcherPoint } from "@/lib/points/calcPoints";
import { formatAvg, formatRate } from "@/lib/format";
import { SUPPORT_ROLES, type SupportRole } from "@/lib/games/buildGameRows";
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
  higherIsBetter?: boolean;
}[] = [
  { key: "name", label: "選手", defaultDir: "asc", getValue: (r) => r.player.name },
  { key: "games", label: "試合", defaultDir: "desc", getValue: (r) => r.games, higherIsBetter: true },
  { key: "pa", label: "打席", defaultDir: "desc", getValue: (r) => r.calc.pa, higherIsBetter: true },
  { key: "ab", label: "打数", defaultDir: "desc", getValue: (r) => r.calc.ab, higherIsBetter: true },
  { key: "runs", label: "得点", defaultDir: "desc", getValue: (r) => r.calc.runs, higherIsBetter: true },
  { key: "hits", label: "安打", defaultDir: "desc", getValue: (r) => r.calc.hits, higherIsBetter: true },
  { key: "doubles", label: "二塁打", defaultDir: "desc", getValue: (r) => r.calc.doubles, higherIsBetter: true },
  { key: "triples", label: "三塁打", defaultDir: "desc", getValue: (r) => r.calc.triples, higherIsBetter: true },
  { key: "hr", label: "本塁打", defaultDir: "desc", getValue: (r) => r.calc.homeruns, higherIsBetter: true },
  { key: "total_bases", label: "塁打数", defaultDir: "desc", getValue: (r) => r.calc.total_bases, higherIsBetter: true },
  { key: "rbi", label: "打点", defaultDir: "desc", getValue: (r) => r.calc.rbi, higherIsBetter: true },
  { key: "steals", label: "盗塁", defaultDir: "desc", getValue: (r) => r.calc.steals, higherIsBetter: true },
  { key: "caught_stealing", label: "盗塁死", defaultDir: "desc", getValue: (r) => r.calc.caught_stealing, higherIsBetter: false },
  { key: "picked_off", label: "牽制死", defaultDir: "desc", getValue: (r) => r.calc.picked_off, higherIsBetter: false },
  { key: "strikeouts", label: "三振", defaultDir: "desc", getValue: (r) => r.calc.strikeouts, higherIsBetter: false },
  { key: "walks", label: "四球", defaultDir: "desc", getValue: (r) => r.calc.walks, higherIsBetter: true },
  { key: "hbp", label: "死球", defaultDir: "desc", getValue: (r) => r.calc.hbp, higherIsBetter: true },
  { key: "sac_bunt", label: "犠打", defaultDir: "desc", getValue: (r) => r.calc.sac_bunt, higherIsBetter: true },
  { key: "sac_fly", label: "犠飛", defaultDir: "desc", getValue: (r) => r.calc.sac_fly, higherIsBetter: true },
  { key: "advancing_hits", label: "進塁打", defaultDir: "desc", getValue: (r) => r.calc.advancing_hits, higherIsBetter: true },
  { key: "double_plays", label: "併殺打", defaultDir: "desc", getValue: (r) => r.calc.double_plays, higherIsBetter: false },
  { key: "avg", label: "打率", defaultDir: "desc", getValue: (r) => r.calc.avg, higherIsBetter: true },
  { key: "obp", label: "出塁率", defaultDir: "desc", getValue: (r) => r.calc.obp, higherIsBetter: true },
  { key: "slg", label: "長打率", defaultDir: "desc", getValue: (r) => r.calc.slg, higherIsBetter: true },
  { key: "ops", label: "OPS", defaultDir: "desc", getValue: (r) => r.calc.ops, higherIsBetter: true },
  { key: "risp", label: "得点圏", defaultDir: "desc", getValue: (r) => r.calc.risp_avg, higherIsBetter: true },
  { key: "rc27", label: "RC27", defaultDir: "desc", getValue: (r) => r.calc.rc27, higherIsBetter: true },
  { key: "point", label: "POINT", defaultDir: "desc", getValue: (r) => r.point ?? -Infinity, higherIsBetter: true },
];

const BATTING_COLUMN_COUNT = BATTING_SORT_COLUMNS.length;

const LEADER_CLASS = "bg-team-gold-soft font-bold text-team-gold";

function computeLeaders<T>(
  rows: T[],
  columns: { key: string; getValue: (r: T) => number; higherIsBetter?: boolean }[]
): Record<string, number> {
  const leaders: Record<string, number> = {};
  for (const col of columns) {
    if (col.higherIsBetter == null) continue;
    const values = rows.map((r) => col.getValue(r)).filter((v) => Number.isFinite(v));
    if (values.length === 0) continue;
    leaders[col.key] = col.higherIsBetter ? Math.max(...values) : Math.min(...values);
  }
  return leaders;
}

function isLeader(value: number, leaderValue: number | undefined): boolean {
  return leaderValue !== undefined && Number.isFinite(value) && Math.abs(value - leaderValue) < 1e-9;
}

const PITCHING_LEADER_COLUMNS: {
  key: string;
  getValue: (r: { calc: ReturnType<typeof calcPitching>; point: number | null }) => number;
  higherIsBetter: boolean;
}[] = [
  { key: "games", getValue: (r) => r.calc.games, higherIsBetter: true },
  { key: "starts", getValue: (r) => r.calc.starts, higherIsBetter: true },
  { key: "wins", getValue: (r) => r.calc.wins, higherIsBetter: true },
  { key: "losses", getValue: (r) => r.calc.losses, higherIsBetter: false },
  { key: "saves", getValue: (r) => r.calc.saves, higherIsBetter: true },
  { key: "holds", getValue: (r) => r.calc.holds, higherIsBetter: true },
  { key: "outs", getValue: (r) => r.calc.outs, higherIsBetter: true },
  { key: "era", getValue: (r) => r.calc.era, higherIsBetter: false },
  { key: "ra", getValue: (r) => r.calc.ra, higherIsBetter: false },
  { key: "strikeouts", getValue: (r) => r.calc.strikeouts, higherIsBetter: true },
  { key: "kRate", getValue: (r) => r.calc.kRate, higherIsBetter: true },
  { key: "bbHbpRate", getValue: (r) => r.calc.bbHbpRate, higherIsBetter: false },
  { key: "whip", getValue: (r) => r.calc.whip, higherIsBetter: false },
  { key: "qs", getValue: (r) => r.calc.qs, higherIsBetter: true },
  { key: "qsRate", getValue: (r) => r.calc.qsRate, higherIsBetter: true },
  { key: "point", getValue: (r) => r.point ?? -Infinity, higherIsBetter: true },
];

const FIELDING_LEADER_COLUMNS: {
  key: string;
  getValue: (r: { calc: ReturnType<typeof calcFielding> }) => number;
  higherIsBetter: boolean;
}[] = [
  { key: "games", getValue: (r) => r.calc.games, higherIsBetter: true },
  { key: "putout", getValue: (r) => r.calc.putout, higherIsBetter: true },
  { key: "assist", getValue: (r) => r.calc.assist, higherIsBetter: true },
  { key: "error", getValue: (r) => r.calc.error, higherIsBetter: false },
  { key: "beauty", getValue: (r) => r.calc.beauty, higherIsBetter: true },
  { key: "rarePlay", getValue: (r) => r.calc.rarePlay, higherIsBetter: true },
  { key: "fieldingPct", getValue: (r) => r.calc.fieldingPct, higherIsBetter: true },
];

type PlayerRow = {
  id: string;
  name: string;
  number: number | null;
  is_guest: boolean;
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

type SupportRow = {
  player_id: string;
  game_id: string;
} & Record<SupportRole, number>;

export default async function StatsPage({ searchParams }: PageProps) {
  const { season: seasonParam, sort: sortParam, dir: dirParam } = await searchParams;

  const [
    { data: players, error: playersError },
    { data: games, error: gamesError },
    { data: battingRows, error: battingError },
    { data: pitchingRows, error: pitchingError },
    { data: fieldingRows, error: fieldingError },
    { data: supportRows, error: supportError },
    { data: seasonParamsRows, error: seasonParamsError },
  ] = await Promise.all([
    fetchAllRows<PlayerRow>((from, to) =>
      supabase.from("players").select("id, name, number, is_guest").range(from, to)
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
    fetchAllRows<SupportRow>((from, to) =>
      supabase
        .from("support_stats")
        .select("player_id, game_id, participate, manage, bench, score, umpire, camera, watch, cheer")
        .range(from, to)
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
  if (supportError) {
    console.error("support_stats fetch failed:", supportError);
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

  const supportByPlayer = new Map<string, SupportRow[]>();
  for (const row of (supportRows ?? []) as SupportRow[]) {
    if (!inScope(row.game_id)) continue;
    const list = supportByPlayer.get(row.player_id) ?? [];
    list.push(row);
    supportByPlayer.set(row.player_id, list);
  }

  // 助っ人（自チーム所属ではない選手）は個人成績には表示しない。
  const playerList = ((players ?? []) as PlayerRow[])
    .filter((p) => !p.is_guest)
    .sort((a, b) => {
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
  const battingLeaders = computeLeaders(
    battingResultsBase.filter((r) => r.qualified),
    BATTING_SORT_COLUMNS as { key: string; getValue: (r: BattingResultRow) => number; higherIsBetter?: boolean }[]
  );

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
  const pitchingLeaders = computeLeaders(
    pitchingResults.filter((r) => r.qualified),
    PITCHING_LEADER_COLUMNS
  );

  const fieldingResults = playerList
    .map((player) => {
      const rows = fieldingByPlayer.get(player.id) ?? [];
      if (rows.length === 0) return null;

      const calc = calcFielding(rows);
      return { player, calc };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.calc.chances - a.calc.chances);
  const fieldingLeaders = computeLeaders(fieldingResults, FIELDING_LEADER_COLUMNS);

  const supportResults = playerList
    .map((player) => {
      const rows = supportByPlayer.get(player.id) ?? [];
      if (rows.length === 0) return null;

      const totals = {} as Record<SupportRole, number>;
      let grandTotal = 0;
      for (const { key } of SUPPORT_ROLES) {
        const sum = rows.reduce((acc, row) => acc + (row[key] ?? 0), 0);
        totals[key] = sum;
        grandTotal += sum;
      }
      if (grandTotal === 0) return null;

      return { player, totals, grandTotal };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.grandTotal - a.grandTotal);
  const supportLeaders = computeLeaders(
    supportResults,
    SUPPORT_ROLES.map(({ key }) => ({
      key,
      getValue: (r: (typeof supportResults)[number]) => r.totals[key],
      higherIsBetter: true,
    }))
  );

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
          <table className="w-full min-w-max text-right text-[10px] sm:text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                {BATTING_SORT_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50 ${col.key === "name" ? "text-left" : ""}`}
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
                      <td
                        colSpan={BATTING_COLUMN_COUNT}
                        className="border-t border-border-subtle bg-surface-muted px-1 py-1 sm:px-3 text-left text-[10px] sm:text-xs text-foreground/50"
                      >
                        規定打席未満
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-border-subtle ${qualified ? "" : "text-foreground/50"}`}>
                    <td className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium">
                      <Link href={`/players/${player.id}`} className="hover:underline">
                        {player.name}
                      </Link>
                    </td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(gamesPlayed, battingLeaders.games) ? LEADER_CLASS : ""}`}>{gamesPlayed}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.pa, battingLeaders.pa) ? LEADER_CLASS : ""}`}>{calc.pa}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.ab, battingLeaders.ab) ? LEADER_CLASS : ""}`}>{calc.ab}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.runs, battingLeaders.runs) ? LEADER_CLASS : ""}`}>{calc.runs}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.hits, battingLeaders.hits) ? LEADER_CLASS : ""}`}>{calc.hits}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.doubles, battingLeaders.doubles) ? LEADER_CLASS : ""}`}>{calc.doubles}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.triples, battingLeaders.triples) ? LEADER_CLASS : ""}`}>{calc.triples}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.homeruns, battingLeaders.hr) ? LEADER_CLASS : ""}`}>{calc.homeruns}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.total_bases, battingLeaders.total_bases) ? LEADER_CLASS : ""}`}>{calc.total_bases}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.rbi, battingLeaders.rbi) ? LEADER_CLASS : ""}`}>{calc.rbi}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.steals, battingLeaders.steals) ? LEADER_CLASS : ""}`}>{calc.steals}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.caught_stealing, battingLeaders.caught_stealing) ? LEADER_CLASS : ""}`}>{calc.caught_stealing}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.picked_off, battingLeaders.picked_off) ? LEADER_CLASS : ""}`}>{calc.picked_off}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.strikeouts, battingLeaders.strikeouts) ? LEADER_CLASS : ""}`}>{calc.strikeouts}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.walks, battingLeaders.walks) ? LEADER_CLASS : ""}`}>{calc.walks}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.hbp, battingLeaders.hbp) ? LEADER_CLASS : ""}`}>{calc.hbp}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.sac_bunt, battingLeaders.sac_bunt) ? LEADER_CLASS : ""}`}>{calc.sac_bunt}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.sac_fly, battingLeaders.sac_fly) ? LEADER_CLASS : ""}`}>{calc.sac_fly}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.advancing_hits, battingLeaders.advancing_hits) ? LEADER_CLASS : ""}`}>{calc.advancing_hits}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.double_plays, battingLeaders.double_plays) ? LEADER_CLASS : ""}`}>{calc.double_plays}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.avg, battingLeaders.avg) ? LEADER_CLASS : ""}`}>{formatAvg(calc.avg)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.obp, battingLeaders.obp) ? LEADER_CLASS : ""}`}>{formatAvg(calc.obp)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.slg, battingLeaders.slg) ? LEADER_CLASS : ""}`}>{formatAvg(calc.slg)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.ops, battingLeaders.ops) ? LEADER_CLASS : ""}`}>{formatAvg(calc.ops)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.risp_avg, battingLeaders.risp) ? LEADER_CLASS : ""}`}>{formatAvg(calc.risp_avg)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.rc27, battingLeaders.rc27) ? LEADER_CLASS : ""}`}>{calc.rc27.toFixed(2)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(point ?? -Infinity, battingLeaders.point) ? LEADER_CLASS : ""}`}>{point ?? "-"}</td>
                  </tr>
                </Fragment>
              ))}
              {battingResults.length === 0 && (
                <tr>
                  <td colSpan={BATTING_COLUMN_COUNT} className="px-3 py-6 text-center text-foreground/50">
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
          <table className="w-full min-w-max text-right text-[10px] sm:text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium text-foreground/50">選手</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">試合</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">先発</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">勝</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">負</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">Ｓ</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">Ｈ</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">投球回</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">防御率</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">失点率</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">奪三振</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">奪三振率</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">与四死球率</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">WHIP</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">QS</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">QS率</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">POINT</th>
              </tr>
            </thead>
            <tbody>
              {pitchingResults.map(({ player, calc, point, qualified }, i) => (
                <Fragment key={player.id}>
                  {i === pitchingQualifiedCount && pitchingQualifiedCount > 0 && (
                    <tr key="divider">
                      <td colSpan={17} className="border-t border-border-subtle bg-surface-muted px-1 py-1 sm:px-3 text-left text-[10px] sm:text-xs text-foreground/50">
                        規定投球回未満
                      </td>
                    </tr>
                  )}
                  <tr className={`border-t border-border-subtle ${qualified ? "" : "text-foreground/50"}`}>
                    <td className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium">
                      <Link href={`/players/${player.id}`} className="hover:underline">
                        {player.name}
                      </Link>
                    </td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.games, pitchingLeaders.games) ? LEADER_CLASS : ""}`}>{calc.games}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.starts, pitchingLeaders.starts) ? LEADER_CLASS : ""}`}>{calc.starts}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.wins, pitchingLeaders.wins) ? LEADER_CLASS : ""}`}>{calc.wins}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.losses, pitchingLeaders.losses) ? LEADER_CLASS : ""}`}>{calc.losses}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.saves, pitchingLeaders.saves) ? LEADER_CLASS : ""}`}>{calc.saves}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.holds, pitchingLeaders.holds) ? LEADER_CLASS : ""}`}>{calc.holds}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.outs, pitchingLeaders.outs) ? LEADER_CLASS : ""}`}>{formatInnings(calc.outs)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.era, pitchingLeaders.era) ? LEADER_CLASS : ""}`}>{formatRate(calc.era)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.ra, pitchingLeaders.ra) ? LEADER_CLASS : ""}`}>{formatRate(calc.ra)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.strikeouts, pitchingLeaders.strikeouts) ? LEADER_CLASS : ""}`}>{calc.strikeouts}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.kRate, pitchingLeaders.kRate) ? LEADER_CLASS : ""}`}>{formatRate(calc.kRate)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.bbHbpRate, pitchingLeaders.bbHbpRate) ? LEADER_CLASS : ""}`}>{formatRate(calc.bbHbpRate)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.whip, pitchingLeaders.whip) ? LEADER_CLASS : ""}`}>{formatRate(calc.whip)}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.qs, pitchingLeaders.qs) ? LEADER_CLASS : ""}`}>{calc.qs}</td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(calc.qsRate, pitchingLeaders.qsRate) ? LEADER_CLASS : ""}`}>
                      {calc.starts > 0 ? `${calc.qsRate.toFixed(1)}%` : "-"}
                    </td>
                    <td className={`px-1 py-1 sm:px-3 sm:py-2 ${qualified && isLeader(point ?? -Infinity, pitchingLeaders.point) ? LEADER_CLASS : ""}`}>{point ?? "-"}</td>
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
          <table className="w-full min-w-max text-right text-[10px] sm:text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium text-foreground/50">選手</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">試合</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">刺殺</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">補殺</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">失策</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">美技</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">珍技</th>
                <th className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">守備率</th>
              </tr>
            </thead>
            <tbody>
              {fieldingResults.map(({ player, calc }) => (
                <tr key={player.id} className="border-t border-border-subtle">
                  <td className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium">
                    <Link href={`/players/${player.id}`} className="hover:underline">
                      {player.name}
                    </Link>
                  </td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.games, fieldingLeaders.games) ? LEADER_CLASS : ""}`}>{calc.games}</td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.putout, fieldingLeaders.putout) ? LEADER_CLASS : ""}`}>{calc.putout}</td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.assist, fieldingLeaders.assist) ? LEADER_CLASS : ""}`}>{calc.assist}</td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.error, fieldingLeaders.error) ? LEADER_CLASS : ""}`}>{calc.error}</td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.beauty, fieldingLeaders.beauty) ? LEADER_CLASS : ""}`}>{calc.beauty}</td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.rarePlay, fieldingLeaders.rarePlay) ? LEADER_CLASS : ""}`}>{calc.rarePlay}</td>
                  <td className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(calc.fieldingPct, fieldingLeaders.fieldingPct) ? LEADER_CLASS : ""}`}>{formatAvg(calc.fieldingPct)}</td>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">サポート実績</h2>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-right text-[10px] sm:text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium text-foreground/50">選手</th>
                {SUPPORT_ROLES.map(({ key, label }) => (
                  <th key={key} className="px-1 py-1 sm:px-3 sm:py-2 font-medium text-foreground/50">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supportResults.map(({ player, totals }) => (
                <tr key={player.id} className="border-t border-border-subtle">
                  <td className="px-1 py-1 sm:px-3 sm:py-2 text-left font-medium">
                    <Link href={`/players/${player.id}`} className="hover:underline">
                      {player.name}
                    </Link>
                  </td>
                  {SUPPORT_ROLES.map(({ key }) => (
                    <td
                      key={key}
                      className={`px-1 py-1 sm:px-3 sm:py-2 ${isLeader(totals[key], supportLeaders[key]) ? LEADER_CLASS : ""}`}
                    >
                      {totals[key]}
                    </td>
                  ))}
                </tr>
              ))}
              {supportResults.length === 0 && (
                <tr>
                  <td colSpan={1 + SUPPORT_ROLES.length} className="px-3 py-6 text-center text-foreground/50">
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
