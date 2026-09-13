import Link from "next/link";

import { supabase } from "@/utils/supabaseClient";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import { getCurrentPlayer } from "@/lib/auth/session";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import { calcPitching } from "@/lib/pitching/calcPitchingStats";
import { formatAvg, formatRate } from "@/lib/format";
import type { PlateResult } from "@/types/plateResult";
import type { PitchingStats } from "@/types/pitching";
import type { SeasonParameters } from "@/types/seasonParameters";
import type { TeamSchedule, Attendance } from "@/types/schedule";

type GameRow = {
  id: string;
  date: string;
  opponent: string;
  league: string | null;
  stadium: string | null;
  scoreboard: { total: { team: number; opponent: number } } | null;
};

type Result = "win" | "loss" | "draw";

function resultOf(g: GameRow): Result | null {
  const total = g.scoreboard?.total;
  if (!total) return null;
  if (total.team > total.opponent) return "win";
  if (total.team < total.opponent) return "loss";
  return "draw";
}

const RESULT_LABEL: Record<Result, string> = { win: "勝", loss: "負", draw: "分" };
const RESULT_CLASS: Record<Result, string> = {
  win: "bg-win/10 text-win",
  loss: "bg-loss/10 text-loss",
  draw: "bg-draw/10 text-draw",
};

type PlayerRow = { id: string; name: string; is_guest: boolean };
type BattingRow = { player_id: string; game_id: string; plate_results: PlateResult[] | null };

function formatDate(dateStr: string): { weekday: string; label: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const label = `${d.getMonth() + 1}/${d.getDate()}`;
  return { weekday, label };
}

export default async function Home() {
  const [{ data: games, error }, { data: latestGame }, player] = await Promise.all([
    supabase
      .from("games")
      .select("id, date, opponent, league, stadium, scoreboard")
      .order("date", { ascending: false })
      .limit(8),
    supabase.from("games").select("date").order("date", { ascending: false }).limit(1).maybeSingle(),
    getCurrentPlayer(),
  ]);

  if (error) {
    console.error(error);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const rows = (games ?? []) as GameRow[];
  const record = rows.reduce(
    (acc, g) => {
      const r = resultOf(g);
      if (r) acc[r]++;
      return acc;
    },
    { win: 0, loss: 0, draw: 0 }
  );

  // --- シーズンリーダー（今シーズンの首位打者・防御率1位）---
  const currentYear = latestGame?.date ? latestGame.date.slice(0, 4) : null;

  let leadingBatter: { id: string; name: string; avg: number } | null = null;
  let leadingPitcher: { id: string; name: string; era: number } | null = null;

  if (currentYear) {
    const [
      { data: yearGames },
      { data: players },
      { data: battingRows },
      { data: pitchingRows },
      { data: seasonParamsRows },
    ] = await Promise.all([
      fetchAllRows<{ id: string }>((from, to) =>
        supabase
          .from("games")
          .select("id")
          .gte("date", `${currentYear}-01-01`)
          .lte("date", `${currentYear}-12-31`)
          .range(from, to)
      ),
      fetchAllRows<PlayerRow>((from, to) =>
        supabase.from("players").select("id, name, is_guest").range(from, to)
      ),
      fetchAllRows<BattingRow>((from, to) =>
        supabase.from("game_batting_stats").select("player_id, game_id, plate_results").range(from, to)
      ),
      fetchAllRows<PitchingStats>((from, to) =>
        supabase.from("game_pitching_stats").select("*").range(from, to)
      ),
      supabase.from("season_parameters").select("*"),
    ]);

    const yearGameIds = new Set((yearGames ?? []).map((g) => g.id));
    const playerList = ((players ?? []) as PlayerRow[]).filter((p) => !p.is_guest);
    const playerNameById = new Map(playerList.map((p) => [p.id, p.name]));

    const seasonParamsList = (seasonParamsRows ?? []) as SeasonParameters[];
    const seasonParams =
      seasonParamsList.find((p) => p.season === Number(currentYear)) ??
      seasonParamsList.find((p) => p.season === 0) ??
      null;
    const requiredPa =
      seasonParams?.required_pa != null ? Math.ceil(yearGameIds.size * seasonParams.required_pa) : null;
    const requiredIp =
      seasonParams?.required_ip != null ? Math.ceil(yearGameIds.size * seasonParams.required_ip) : null;

    const battingByPlayer = new Map<string, BattingRow[]>();
    for (const row of (battingRows ?? []) as BattingRow[]) {
      if (!yearGameIds.has(row.game_id)) continue;
      const list = battingByPlayer.get(row.player_id) ?? [];
      list.push(row);
      battingByPlayer.set(row.player_id, list);
    }
    const battingLeaders = [...battingByPlayer.entries()]
      .filter(([playerId]) => playerNameById.has(playerId))
      .map(([playerId, rowsForPlayer]) => {
        const calc = calcBatting(rowsForPlayer.flatMap((r) => r.plate_results ?? []));
        return { id: playerId, name: playerNameById.get(playerId)!, avg: calc.avg, pa: calc.pa };
      })
      .filter((p) => requiredPa == null || p.pa >= requiredPa)
      .sort((a, b) => b.avg - a.avg);
    if (battingLeaders.length > 0) leadingBatter = battingLeaders[0];

    const pitchingByPlayer = new Map<string, PitchingStats[]>();
    for (const row of (pitchingRows ?? []) as PitchingStats[]) {
      if (!yearGameIds.has(row.game_id)) continue;
      const list = pitchingByPlayer.get(row.player_id) ?? [];
      list.push(row);
      pitchingByPlayer.set(row.player_id, list);
    }
    const pitchingLeaders = [...pitchingByPlayer.entries()]
      .filter(([playerId]) => playerNameById.has(playerId))
      .map(([playerId, rowsForPlayer]) => {
        const calc = calcPitching(rowsForPlayer);
        return { id: playerId, name: playerNameById.get(playerId)!, era: calc.era, ip: calc.inningsReal };
      })
      .filter((p) => requiredIp == null || p.ip >= requiredIp)
      .sort((a, b) => a.era - b.era);
    if (pitchingLeaders.length > 0) leadingPitcher = pitchingLeaders[0];
  }

  // --- 次回の予定 ---
  const today = new Date().toISOString().slice(0, 10);
  const { data: nextSchedule } = await supabase
    .from("team_schedule")
    .select("*")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  let notRespondedCount: number | null = null;
  if (nextSchedule && player) {
    const sessionSupabase = await createServerClient();
    const [{ data: attendanceRows }, { data: nonGuestPlayers }] = await Promise.all([
      sessionSupabase
        .from("schedule_attendance")
        .select("player_id")
        .eq("schedule_id", (nextSchedule as TeamSchedule).id),
      fetchAllRows<{ id: string }>((from, to) =>
        supabase.from("players").select("id").eq("is_guest", false).range(from, to)
      ),
    ]);
    const respondedIds = new Set(((attendanceRows ?? []) as Pick<Attendance, "player_id">[]).map((a) => a.player_id));
    notRespondedCount = (nonGuestPlayers ?? []).filter((p) => !respondedIds.has(p.id)).length;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <section className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-team-red to-team-red-bright px-6 py-5 text-white sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">
            レールウェイズ 成績管理
          </h1>
          <span className="text-xs font-semibold tracking-wide text-white/70">
            RAILWAYS BASEBALL CLUB
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3">
          <Link
            href="/games"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-team-red transition-colors hover:bg-white/90"
          >
            試合結果を見る
          </Link>
          <Link
            href="/stats"
            className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/20"
          >
            個人成績を見る
          </Link>
        </div>
      </section>

      {(nextSchedule || rows[0]) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {nextSchedule && (
            <Link
              href="/schedule"
              className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface p-4 transition-shadow hover:shadow-md"
            >
              <span className="text-xs font-medium text-foreground/50">次回の予定</span>
              <span className="text-lg font-bold">
                {formatDate((nextSchedule as TeamSchedule).date).label}（
                {formatDate((nextSchedule as TeamSchedule).date).weekday}）
              </span>
              <span className="truncate text-sm text-foreground/70">
                {(nextSchedule as TeamSchedule).title}
                {(nextSchedule as TeamSchedule).opponent
                  ? ` ・ vs ${(nextSchedule as TeamSchedule).opponent}`
                  : ""}
              </span>
              <span className="truncate text-xs text-foreground/50">
                {(nextSchedule as TeamSchedule).start_time
                  ? (nextSchedule as TeamSchedule).start_time!.slice(0, 5)
                  : "時刻未定"}
                {(nextSchedule as TeamSchedule).place ? ` ・ ${(nextSchedule as TeamSchedule).place}` : ""}
              </span>
              {notRespondedCount != null && notRespondedCount > 0 && (
                <span className="text-xs font-semibold text-loss">未回答 {notRespondedCount}人</span>
              )}
            </Link>
          )}
          {rows[0] &&
            (() => {
              const latest = rows[0];
              const total = latest.scoreboard?.total;
              const result = resultOf(latest);
              return (
                <Link
                  href={`/games/${latest.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-foreground/50">最新の試合結果</span>
                    {result && (
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${RESULT_CLASS[result]}`}>
                        {RESULT_LABEL[result]}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-lg font-bold">vs {latest.opponent}</span>
                  <div className="flex items-baseline justify-between">
                    {total && (
                      <span className="font-mono text-2xl font-black tabular-nums text-team-red">
                        {total.team}
                        <span className="mx-0.5 text-foreground/30">-</span>
                        {total.opponent}
                      </span>
                    )}
                    <span className="text-xs text-foreground/50">{latest.date}</span>
                  </div>
                </Link>
              );
            })()}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">最新の試合結果</h2>
          <Link href="/games" className="text-sm font-medium text-team-red hover:underline">
            すべて見る →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
            まだ試合結果がありません
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((g) => {
              const total = g.scoreboard?.total;
              const result = resultOf(g);
              return (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground/50">{g.date}</span>
                    {result && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${RESULT_CLASS[result]}`}
                      >
                        {RESULT_LABEL[result]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="truncate text-sm font-semibold">vs {g.opponent}</span>
                    {total && (
                      <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
                        {total.team}
                        <span className="mx-0.5 text-foreground/30">-</span>
                        {total.opponent}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-foreground/50">
                    {g.league ?? g.stadium}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-xs text-foreground/50">
            直近{rows.length}試合: {record.win}勝{record.loss}敗
            {record.draw > 0 ? `${record.draw}分` : ""}
          </p>
        )}
      </section>

      {(leadingBatter || leadingPitcher) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{currentYear}年 シーズンリーダー</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {leadingBatter && (
              <Link
                href={`/players/${leadingBatter.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface p-4 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-medium text-foreground/50">首位打者</span>
                <span className="text-lg font-bold">{leadingBatter.name}</span>
                <span className="font-mono text-2xl font-black tabular-nums text-team-red">
                  {formatAvg(leadingBatter.avg)}
                </span>
              </Link>
            )}
            {leadingPitcher && (
              <Link
                href={`/players/${leadingPitcher.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface p-4 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-medium text-foreground/50">防御率1位</span>
                <span className="text-lg font-bold">{leadingPitcher.name}</span>
                <span className="font-mono text-2xl font-black tabular-nums text-team-red">
                  {formatRate(leadingPitcher.era)}
                </span>
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
