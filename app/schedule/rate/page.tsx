import Link from "next/link";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import type { Attendance } from "@/types/schedule";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

type PlayerRow = { id: string; name: string; number: number | null; is_guest: boolean };
type ScheduleRow = { id: string; date: string };

export default async function ScheduleRatePage({ searchParams }: PageProps) {
  await requireAdmin("/schedule/rate");
  const { year: yearParam } = await searchParams;

  const sessionSupabase = await createClient();
  const [{ data: schedules }, { data: players }, { data: attendanceRows }] = await Promise.all([
    fetchAllRows<ScheduleRow>((from, to) =>
      supabase.from("team_schedule").select("id, date").range(from, to)
    ),
    fetchAllRows<PlayerRow>((from, to) =>
      supabase.from("players").select("id, name, number, is_guest").range(from, to)
    ),
    fetchAllRows<Attendance>((from, to) =>
      sessionSupabase.from("schedule_attendance").select("*").range(from, to)
    ),
  ]);

  const scheduleList = schedules ?? [];
  const years = Array.from(new Set(scheduleList.map((s) => s.date.slice(0, 4)))).sort(
    (a, b) => Number(b) - Number(a)
  );
  const selectedYear = yearParam && years.includes(yearParam) ? yearParam : (years[0] ?? "");

  const scheduleIdsInYear = new Set(
    scheduleList.filter((s) => s.date.slice(0, 4) === selectedYear).map((s) => s.id)
  );
  const totalSchedules = scheduleIdsInYear.size;

  const attendanceByPlayer = new Map<string, Attendance[]>();
  for (const a of attendanceRows ?? []) {
    if (!scheduleIdsInYear.has(a.schedule_id)) continue;
    const list = attendanceByPlayer.get(a.player_id) ?? [];
    list.push(a);
    attendanceByPlayer.set(a.player_id, list);
  }

  const nonGuestPlayers = (players ?? [])
    .filter((p) => !p.is_guest)
    .slice()
    .sort((a, b) => {
      if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
      if (a.number == null) return 1;
      if (b.number == null) return -1;
      return a.number - b.number;
    });

  const rows = nonGuestPlayers.map((p) => {
    const attendance = attendanceByPlayer.get(p.id) ?? [];
    const counts = { 出席: 0, 欠席: 0, 未定: 0 };
    for (const a of attendance) counts[a.attendance]++;
    const responded = attendance.length;
    const notResponded = totalSchedules - responded;
    const rate = totalSchedules > 0 ? counts.出席 / totalSchedules : 0;
    return { player: p, counts, notResponded: Math.max(notResponded, 0), rate };
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">年度別参加率</h1>
        <Link href="/schedule" className="text-sm text-foreground/50 underline hover:text-foreground">
          スケジュールへ戻る
        </Link>
      </div>

      <nav className="flex flex-wrap items-center gap-1.5">
        {years.map((year) => (
          <Link
            key={year}
            href={`/schedule/rate?year=${year}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selectedYear === year
                ? "bg-team-red text-white"
                : "bg-surface-muted text-foreground/70 hover:bg-border-subtle"
            }`}
          >
            {year}年
          </Link>
        ))}
      </nav>

      <span className="text-xs text-foreground/50">{selectedYear}年の予定件数: {totalSchedules}件</span>

      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className="w-full min-w-max text-right text-sm tabular-nums">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-foreground/50">選手</th>
              <th className="px-3 py-2 font-medium text-foreground/50">出席</th>
              <th className="px-3 py-2 font-medium text-foreground/50">欠席</th>
              <th className="px-3 py-2 font-medium text-foreground/50">未定</th>
              <th className="px-3 py-2 font-medium text-foreground/50">未回答</th>
              <th className="px-3 py-2 font-medium text-foreground/50">参加率</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .sort((a, b) => b.rate - a.rate)
              .map(({ player, counts, notResponded, rate }) => (
                <tr key={player.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2 text-left font-medium">{player.name}</td>
                  <td className="px-3 py-2">{counts.出席}</td>
                  <td className="px-3 py-2">{counts.欠席}</td>
                  <td className="px-3 py-2">{counts.未定}</td>
                  <td className="px-3 py-2">{notResponded}</td>
                  <td className="px-3 py-2 font-semibold">{(rate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-foreground/50">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
