import Link from "next/link";
import { notFound } from "next/navigation";

import { supabase } from "@/utils/supabaseClient";
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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
};

type BattingRow = { game_id: string; order_no: number | null; plate_results: PlateResult[] | null };
type SupportRow = { game_id: string } & Record<SupportRole, number>;
type GameRow = { id: string; date: string; opponent: string };

function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col gap-0.5 rounded-lg border border-border-subtle bg-surface px-3 py-2"
        >
          <span className="text-xs text-foreground/50">{label}</span>
          <span className="text-base font-semibold tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function PlayerDetailPage({ params, searchParams }: PageProps) {
  const { id: rawId } = await params;
  // このNext.jsフォークはstock Next.jsと異なり動的セグメントを自動でURLデコード
  // しない。選手IDには日本語がそのまま使われている（例: "石ちゃん"）ため、
  // デコードしないとDBの実際のIDと一致せず notFound() になってしまう。
  const id = decodeURIComponent(rawId);
  const { season: seasonParam } = await searchParams;

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, name, number, is_guest")
    .eq("id", id)
    .maybeSingle();
  if (playerError || !player) {
    notFound();
  }

  const [
    { data: battingRows, error: battingError },
    { data: pitchingRows, error: pitchingError },
    { data: fieldingRows, error: fieldingError },
    { data: supportRows, error: supportError },
    { data: seasonParamsRows, error: seasonParamsError },
  ] = await Promise.all([
    supabase.from("game_batting_stats").select("game_id, order_no, plate_results").eq("player_id", id),
    supabase.from("game_pitching_stats").select("*").eq("player_id", id),
    supabase.from("game_fielding_stats").select("*").eq("player_id", id),
    supabase
      .from("support_stats")
      .select("game_id, participate, manage, bench, score, umpire, camera, watch, cheer")
      .eq("player_id", id),
    supabase.from("season_parameters").select("*"),
  ]);

  if (battingError || pitchingError || fieldingError || supportError) {
    console.error(battingError, pitchingError, fieldingError, supportError);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }
  if (seasonParamsError) {
    console.error("season_parameters fetch failed:", seasonParamsError);
  }

  const battingList = (battingRows ?? []) as BattingRow[];
  const pitchingList = (pitchingRows ?? []) as PitchingStats[];
  const fieldingList = (fieldingRows ?? []) as FieldingStats[];
  const supportList = (supportRows ?? []) as SupportRow[];

  const gameIds = [
    ...new Set([
      ...battingList.map((r) => r.game_id),
      ...pitchingList.map((r) => r.game_id),
      ...fieldingList.map((r) => r.game_id),
      ...supportList.map((r) => r.game_id),
    ]),
  ];

  const { data: games, error: gamesError } =
    gameIds.length > 0
      ? await supabase.from("games").select("id, date, opponent").in("id", gameIds)
      : { data: [] as GameRow[], error: null };
  if (gamesError) {
    console.error(gamesError);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const gameList = (games ?? []) as GameRow[];
  const gameById = new Map(gameList.map((g) => [g.id, g]));
  const seasonYears = Array.from(new Set(gameList.map((g) => g.date.slice(0, 4)))).sort(
    (a, b) => Number(b) - Number(a)
  );
  const selectedSeason =
    seasonParam && (seasonParam === "all" || seasonYears.includes(seasonParam)) ? seasonParam : "all";

  const inScope = (gameId: string) => {
    if (selectedSeason === "all") return true;
    const g = gameById.get(gameId);
    return !!g && g.date.slice(0, 4) === selectedSeason;
  };

  const battingInScope = battingList.filter((r) => inScope(r.game_id));
  const pitchingInScope = pitchingList.filter((r) => inScope(r.game_id));
  const fieldingInScope = fieldingList.filter((r) => inScope(r.game_id));
  const supportInScope = supportList.filter((r) => inScope(r.game_id));

  const seasonParamsList = (seasonParamsRows ?? []) as SeasonParameters[];
  const seasonParams =
    (selectedSeason !== "all"
      ? seasonParamsList.find((p) => p.season === Number(selectedSeason))
      : undefined) ?? seasonParamsList.find((p) => p.season === 0) ?? null;

  const plateResults = battingInScope.flatMap((r) => (r.plate_results ?? []) as PlateResult[]);
  const battingCalc = calcBatting(plateResults);
  const battingGames = new Set(battingInScope.map((r) => r.game_id)).size;

  const fieldingCalc = calcFielding(fieldingInScope);
  const pitchingCalc = calcPitching(pitchingInScope, {
    qsMinInnings: seasonParams?.qs ?? undefined,
    qsMaxEarnedRuns: seasonParams?.earned_runs ?? undefined,
  });

  const batterPoint = seasonParams ? calcBatterPoint(battingCalc, fieldingCalc, seasonParams) : null;
  const pitcherPoint = seasonParams ? calcPitcherPoint(pitchingCalc, seasonParams) : null;

  const supportTotals = {} as Record<SupportRole, number>;
  for (const { key } of SUPPORT_ROLES) {
    supportTotals[key] = supportInScope.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  }
  const hasSupport = SUPPORT_ROLES.some(({ key }) => supportTotals[key] > 0);

  // --- 試合別成績（打撃・投手）---
  const gameBattingRows = battingInScope
    .map((r) => {
      const g = gameById.get(r.game_id);
      if (!g) return null;
      return { gameId: r.game_id, date: g.date, opponent: g.opponent, calc: calcBatting(r.plate_results ?? []) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const gamePitchingRows = pitchingInScope
    .map((r) => {
      const g = gameById.get(r.game_id);
      if (!g) return null;
      return {
        gameId: r.game_id,
        date: g.date,
        opponent: g.opponent,
        calc: calcPitching([r], {
          qsMinInnings: seasonParams?.qs ?? undefined,
          qsMaxEarnedRuns: seasonParams?.earned_runs ?? undefined,
        }),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // --- 月別成績（打撃）---
  function formatMonth(month: string): string {
    const [y, m] = month.split("-");
    return `${y}年${Number(m)}月`;
  }
  const monthlyBattingMap = new Map<string, { games: Set<string>; results: PlateResult[] }>();
  for (const r of battingInScope) {
    const g = gameById.get(r.game_id);
    if (!g) continue;
    const month = g.date.slice(0, 7);
    const entry = monthlyBattingMap.get(month) ?? { games: new Set<string>(), results: [] };
    entry.games.add(r.game_id);
    entry.results.push(...((r.plate_results ?? []) as PlateResult[]));
    monthlyBattingMap.set(month, entry);
  }
  const monthlyBattingRows = [...monthlyBattingMap.entries()]
    .map(([month, { games, results }]) => ({ month, games: games.size, calc: calcBatting(results) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  // --- 打順別成績 ---
  const orderBattingMap = new Map<number, { games: Set<string>; results: PlateResult[] }>();
  for (const r of battingInScope) {
    if (r.order_no == null) continue;
    const entry = orderBattingMap.get(r.order_no) ?? { games: new Set<string>(), results: [] };
    entry.games.add(r.game_id);
    entry.results.push(...((r.plate_results ?? []) as PlateResult[]));
    orderBattingMap.set(r.order_no, entry);
  }
  const orderBattingRows = [...orderBattingMap.entries()]
    .map(([orderNo, { games, results }]) => ({ orderNo, games: games.size, calc: calcBatting(results) }))
    .sort((a, b) => a.orderNo - b.orderNo);

  // --- 対戦左右別成績 ---
  const HAND_LABELS: Record<string, string> = { 右: "対右投手", 左: "対左投手", 不明: "不明" };
  const HAND_ORDER = ["右", "左", "不明"];
  const handBattingMap = new Map<string, PlateResult[]>();
  for (const pr of plateResults) {
    if (!pr.pitcher_hand) continue;
    const list = handBattingMap.get(pr.pitcher_hand) ?? [];
    list.push(pr);
    handBattingMap.set(pr.pitcher_hand, list);
  }
  const handBattingRows = HAND_ORDER.filter((h) => handBattingMap.has(h)).map((hand) => ({
    hand,
    label: HAND_LABELS[hand] ?? hand,
    calc: calcBatting(handBattingMap.get(hand)!),
  }));

  // --- 打球傾向（方向別・種類別）---
  // direction/contact_type は未入力のため、打席結果の表記（例: "中安"=中堅安打,
  // "三ゴ"=三塁ゴロ, "左飛"=左翼フライ）から推定する。表記は先頭1文字が方向
  // （投・捕・一・二・三・遊・左・中・右）、続く1〜2文字が結果というルール
  // （calcBatting.ts の分類ロジックと同じ前提）。
  const DIRECTION_ORDER = ["投", "捕", "一", "二", "三", "遊", "左", "中", "右"];
  const DIRECTION_CHARS = new Set(DIRECTION_ORDER);
  const NON_BATTED_BALL_TOKENS = ["四球", "死球", "三振", "振逃", "打妨", "代走"];

  function isNonBattedBall(result: string): boolean {
    return NON_BATTED_BALL_TOKENS.some((token) => result.includes(token));
  }
  function inferDirection(result: string): string | null {
    if (isNonBattedBall(result)) return null;
    const d = result.charAt(0);
    return DIRECTION_CHARS.has(d) ? d : null;
  }
  function inferContactType(result: string): "ゴロ" | "フライ" | "ライナー" | null {
    const direction = inferDirection(result);
    if (!direction) return null;
    const rest = result.slice(1);
    const isOutfield = direction === "左" || direction === "中" || direction === "右";

    if (rest.includes("ゴ")) return "ゴロ";
    if (rest.includes("飛")) return "フライ";
    if (rest.includes("直")) return "ライナー";
    if (rest.includes("邪")) return "フライ"; // 邪飛（ファウルフライ）は必ず打球が浮いている
    if (rest.includes("犠")) return isOutfield ? "フライ" : "ゴロ"; // 犠飛/犠打
    if (rest.includes("併")) return "ゴロ"; // 併殺打はほぼ内野ゴロ
    if (rest.includes("野")) return "ゴロ"; // 野選は走者封殺が前提なのでゴロ
    if (rest === "内" || rest === "バ") return "ゴロ"; // 内野安打・バント安打
    // 外野への安打（安・二・三・本）や失策は打球種類を表記から判別できない
    return null;
  }

  const directionMap = new Map<string, PlateResult[]>();
  const contactTypeMap = new Map<string, PlateResult[]>();
  for (const pr of plateResults) {
    const direction = inferDirection(pr.result);
    if (direction) {
      const list = directionMap.get(direction) ?? [];
      list.push(pr);
      directionMap.set(direction, list);
    }
    const contactType = inferContactType(pr.result);
    if (contactType) {
      const list = contactTypeMap.get(contactType) ?? [];
      list.push(pr);
      contactTypeMap.set(contactType, list);
    }
  }
  const directionRows = DIRECTION_ORDER.filter((d) => directionMap.has(d)).map((direction) => ({
    direction,
    calc: calcBatting(directionMap.get(direction)!),
  }));

  const CONTACT_TYPE_ORDER = ["ゴロ", "フライ", "ライナー"] as const;
  const contactTypeRows = CONTACT_TYPE_ORDER.filter((t) => contactTypeMap.has(t)).map((type) => ({
    type,
    calc: calcBatting(contactTypeMap.get(type)!),
  }));

  type GameLogEntry = { gameId: string; date: string; opponent: string; roles: string[] };
  const gameLog = new Map<string, GameLogEntry>();
  function markRole(gameId: string, role: string) {
    if (!inScope(gameId)) return;
    const g = gameById.get(gameId);
    if (!g) return;
    const entry = gameLog.get(gameId) ?? { gameId, date: g.date, opponent: g.opponent, roles: [] };
    if (!entry.roles.includes(role)) entry.roles.push(role);
    gameLog.set(gameId, entry);
  }
  for (const r of battingList) markRole(r.game_id, "打");
  for (const r of pitchingList) markRole(r.game_id, "投");
  for (const r of fieldingList) markRole(r.game_id, "守");
  for (const r of supportList) markRole(r.game_id, "サポ");
  const gameLogList = [...gameLog.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-foreground/50">選手詳細{player.is_guest ? "（助っ人）" : ""}</span>
        <h1 className="text-2xl font-black tracking-tight">
          {player.number != null ? `${player.number} ` : ""}
          {player.name}
        </h1>
      </div>

      <nav className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/players/${id}?season=all`}
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
            href={`/players/${id}?season=${year}`}
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

      {battingCalc.pa > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">打撃成績</h2>
          <StatGrid
            items={[
              { label: "試合", value: battingGames },
              { label: "打席", value: battingCalc.pa },
              { label: "打数", value: battingCalc.ab },
              { label: "安打", value: battingCalc.hits },
              { label: "打率", value: formatAvg(battingCalc.avg) },
              { label: "二塁打", value: battingCalc.doubles },
              { label: "三塁打", value: battingCalc.triples },
              { label: "本塁打", value: battingCalc.homeruns },
              { label: "塁打数", value: battingCalc.total_bases },
              { label: "打点", value: battingCalc.rbi },
              { label: "得点", value: battingCalc.runs },
              { label: "盗塁", value: battingCalc.steals },
              { label: "盗塁死", value: battingCalc.caught_stealing },
              { label: "牽制死", value: battingCalc.picked_off },
              { label: "三振", value: battingCalc.strikeouts },
              { label: "四球", value: battingCalc.walks },
              { label: "死球", value: battingCalc.hbp },
              { label: "犠打", value: battingCalc.sac_bunt },
              { label: "犠飛", value: battingCalc.sac_fly },
              { label: "進塁打", value: battingCalc.advancing_hits },
              { label: "併殺打", value: battingCalc.double_plays },
              { label: "出塁率", value: formatAvg(battingCalc.obp) },
              { label: "長打率", value: formatAvg(battingCalc.slg) },
              { label: "OPS", value: formatAvg(battingCalc.ops) },
              { label: "得点圏打率", value: formatAvg(battingCalc.risp_avg) },
              { label: "RC27", value: battingCalc.rc27.toFixed(2) },
              { label: "POINT", value: batterPoint ?? "-" },
            ]}
          />
        </section>
      )}

      {pitchingCalc.games > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">投手成績</h2>
          <StatGrid
            items={[
              { label: "試合", value: pitchingCalc.games },
              { label: "先発", value: pitchingCalc.starts },
              { label: "勝", value: pitchingCalc.wins },
              { label: "負", value: pitchingCalc.losses },
              { label: "Ｓ", value: pitchingCalc.saves },
              { label: "Ｈ", value: pitchingCalc.holds },
              { label: "投球回", value: formatInnings(pitchingCalc.outs) },
              { label: "防御率", value: formatRate(pitchingCalc.era) },
              { label: "失点率", value: formatRate(pitchingCalc.ra) },
              { label: "奪三振", value: pitchingCalc.strikeouts },
              { label: "奪三振率", value: formatRate(pitchingCalc.kRate) },
              { label: "与四死球率", value: formatRate(pitchingCalc.bbHbpRate) },
              { label: "WHIP", value: formatRate(pitchingCalc.whip) },
              { label: "QS", value: pitchingCalc.qs },
              {
                label: "QS率",
                value: pitchingCalc.starts > 0 ? `${pitchingCalc.qsRate.toFixed(1)}%` : "-",
              },
              { label: "POINT", value: pitcherPoint ?? "-" },
            ]}
          />
        </section>
      )}

      {fieldingCalc.games > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">守備成績</h2>
          <StatGrid
            items={[
              { label: "試合", value: fieldingCalc.games },
              { label: "刺殺", value: fieldingCalc.putout },
              { label: "補殺", value: fieldingCalc.assist },
              { label: "失策", value: fieldingCalc.error },
              { label: "美技", value: fieldingCalc.beauty },
              { label: "珍技", value: fieldingCalc.rarePlay },
              { label: "守備率", value: formatAvg(fieldingCalc.fieldingPct) },
            ]}
          />
        </section>
      )}

      {hasSupport && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">サポート実績</h2>
          <StatGrid items={SUPPORT_ROLES.map(({ key, label }) => ({ label, value: supportTotals[key] }))} />
        </section>
      )}

      {gameBattingRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">試合別成績（打撃）</h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">試合</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打席</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打数</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">安打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">本塁打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">得点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">盗塁</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">三振</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">四球</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打率</th>
                </tr>
              </thead>
              <tbody>
                {gameBattingRows.map((r) => (
                  <tr key={r.gameId} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">
                      <Link href={`/games/${r.gameId}`} className="hover:underline">
                        {r.date} vs {r.opponent}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.pa}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.ab}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hits}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.homeruns}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.rbi}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.runs}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.steals}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.strikeouts}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.walks}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {gamePitchingRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">試合別成績（投手）</h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">試合</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">投球回</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">自責点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">失点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">奪三振</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">四球</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">与死球</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">被安打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">防御率</th>
                </tr>
              </thead>
              <tbody>
                {gamePitchingRows.map((r) => (
                  <tr key={r.gameId} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">
                      <Link href={`/games/${r.gameId}`} className="hover:underline">
                        {r.date} vs {r.opponent}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatInnings(r.calc.outs)}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.er}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.runs}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.strikeouts}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.walks}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hbp}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hitsAllowed}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatRate(r.calc.era)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {monthlyBattingRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">月別成績（打撃）</h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">月</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">試合</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打席</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打数</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">安打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">本塁打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打率</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">OPS</th>
                </tr>
              </thead>
              <tbody>
                {monthlyBattingRows.map((r) => (
                  <tr key={r.month} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">{formatMonth(r.month)}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.games}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.pa}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.ab}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hits}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.homeruns}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.rbi}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.avg)}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.ops)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {orderBattingRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">打順別成績</h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">打順</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">試合</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打席</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打数</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">安打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">本塁打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打率</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">OPS</th>
                </tr>
              </thead>
              <tbody>
                {orderBattingRows.map((r) => (
                  <tr key={r.orderNo} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">{r.orderNo}番</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.games}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.pa}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.ab}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hits}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.homeruns}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.rbi}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.avg)}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.ops)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(directionRows.length > 0 || contactTypeRows.length > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">打球傾向</h2>
            <span className="text-xs text-foreground/40">※打席結果の表記から推定（種類は一部「不明」を除外）</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {directionRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
                <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
                  <thead className="bg-surface-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">方向</th>
                      <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打数</th>
                      <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">安打</th>
                      <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directionRows.map((r) => (
                      <tr key={r.direction} className="border-t border-border-subtle">
                        <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">{r.direction}</td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.ab}</td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hits}</td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {contactTypeRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
                <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
                  <thead className="bg-surface-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">種類</th>
                      <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打数</th>
                      <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">安打</th>
                      <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactTypeRows.map((r) => (
                      <tr key={r.type} className="border-t border-border-subtle">
                        <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">{r.type}</td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.ab}</td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hits}</td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {handBattingRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">対戦左右別成績</h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full min-w-max text-right text-xs sm:text-sm tabular-nums">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-foreground/50 sm:px-3 sm:py-2">対戦投手</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打席</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打数</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">安打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">本塁打</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打点</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">打率</th>
                  <th className="px-2 py-1.5 font-medium text-foreground/50 sm:px-3 sm:py-2">OPS</th>
                </tr>
              </thead>
              <tbody>
                {handBattingRows.map((r) => (
                  <tr key={r.hand} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">{r.label}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.pa}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.ab}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.hits}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.homeruns}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{r.calc.rbi}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.avg)}</td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{formatAvg(r.calc.ops)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">出場試合</h2>
        {gameLogList.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
            この期間の出場記録がありません
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
            {gameLogList.map((g) => (
              <Link
                key={g.gameId}
                href={`/games/${g.gameId}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="text-foreground/50">{g.date}</span>
                <span className="flex-1 truncate font-medium">vs {g.opponent}</span>
                <span className="flex gap-1">
                  {g.roles.map((r) => (
                    <span
                      key={r}
                      className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-foreground/60"
                    >
                      {r}
                    </span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
