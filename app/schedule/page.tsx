import Link from "next/link";

import { supabase } from "@/utils/supabaseClient";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import { getCurrentPlayer } from "@/lib/auth/session";
import type { TeamSchedule, Attendance } from "@/types/schedule";
import ScheduleCalendar from "./ScheduleCalendar";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

const STATUS_CLASS: Record<string, string> = {
  出席: "bg-win/10 text-win",
  欠席: "bg-loss/10 text-loss",
  未定: "bg-draw/10 text-draw",
};

function formatDate(dateStr: string): { weekday: string; label: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const label = `${d.getMonth() + 1}/${d.getDate()}`;
  return { weekday, label };
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { month: monthParam } = await searchParams;

  const [{ data: scheduleRows, error }, { data: playerRows }, player] = await Promise.all([
    fetchAllRows<TeamSchedule>((from, to) =>
      supabase.from("team_schedule").select("*").order("date", { ascending: true }).range(from, to)
    ),
    fetchAllRows<{ id: string; name: string; is_guest: boolean }>((from, to) =>
      supabase.from("players").select("id, name, is_guest").range(from, to)
    ),
    getCurrentPlayer(),
  ]);

  if (error) {
    console.error(error);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const schedules = (scheduleRows ?? []) as TeamSchedule[];
  // 助っ人は自チームの出欠管理対象ではないため「未回答」判定から除外する。
  const nonGuestPlayers = (playerRows ?? []).filter((p) => !p.is_guest);

  // 出欠明細はログインユーザーのみ閲覧可（RLS）。未ログインでは取得できず
  // エラーになるので、その場合は出欠集計なしで表示する。
  let attendanceBySchedule = new Map<string, Attendance[]>();
  if (schedules.length > 0) {
    const sessionSupabase = await createServerClient();
    const { data: attendanceRows } = await fetchAllRows<Attendance>((from, to) =>
      sessionSupabase
        .from("schedule_attendance")
        .select("*")
        .in(
          "schedule_id",
          schedules.map((s) => s.id)
        )
        .range(from, to)
    );

    if (attendanceRows) {
      const map = new Map<string, Attendance[]>();
      for (const row of attendanceRows as Attendance[]) {
        const list = map.get(row.schedule_id) ?? [];
        list.push(row);
        map.set(row.schedule_id, list);
      }
      attendanceBySchedule = map;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = schedules.filter((s) => s.date >= today);
  const past = schedules.filter((s) => s.date < today).reverse();

  const selectedMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const loggedIn = !!player;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">スケジュール</h1>
        {player?.is_admin && (
          <div className="flex items-center gap-3">
            <Link
              href="/schedule/rate"
              className="text-sm text-foreground/50 underline hover:text-foreground"
            >
              年度別参加率
            </Link>
            <Link
              href="/schedule/new"
              className="rounded-md bg-team-red px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright"
            >
              ＋予定を追加
            </Link>
          </div>
        )}
      </div>

      <ScheduleCalendar schedules={schedules} month={selectedMonth} />

      <ScheduleSection
        title="今後の予定"
        items={upcoming}
        attendanceBySchedule={attendanceBySchedule}
        nonGuestPlayers={loggedIn ? nonGuestPlayers : null}
        emptyMessage="今のところ予定はありません"
      />

      {past.length > 0 && (
        <ScheduleSection
          title="過去の予定"
          items={past}
          attendanceBySchedule={attendanceBySchedule}
          nonGuestPlayers={loggedIn ? nonGuestPlayers : null}
          emptyMessage=""
          muted
        />
      )}
    </div>
  );
}

function ScheduleSection({
  title,
  items,
  attendanceBySchedule,
  nonGuestPlayers,
  emptyMessage,
  muted,
}: {
  title: string;
  items: TeamSchedule[];
  attendanceBySchedule: Map<string, Attendance[]>;
  nonGuestPlayers: { id: string; name: string }[] | null;
  emptyMessage: string;
  muted?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{title}</h2>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
          {emptyMessage}
        </p>
      ) : (
        <div className={`flex flex-col gap-2 ${muted ? "opacity-70" : ""}`}>
          {items.map((s) => {
            const { weekday, label } = formatDate(s.date);
            const attendance = attendanceBySchedule.get(s.id) ?? [];
            const counts = { 出席: 0, 欠席: 0, 未定: 0 };
            for (const a of attendance) counts[a.attendance]++;

            const respondedIds = new Set(attendance.map((a) => a.player_id));
            const notResponded = nonGuestPlayers?.filter((p) => !respondedIds.has(p.id)) ?? [];

            return (
              <div
                key={s.id}
                id={s.id}
                className="flex scroll-mt-20 flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-muted py-1.5">
                      <span className="text-xs font-medium text-foreground/50">
                        {weekday}
                      </span>
                      <span className="text-base font-bold tabular-nums">{label}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.status && (
                          <span className="rounded bg-team-gold-soft px-1.5 py-0.5 text-xs font-bold text-team-gold">
                            {s.status}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{s.title}</span>
                      </div>
                      <span className="text-xs text-foreground/50">
                        {s.start_time ? s.start_time.slice(0, 5) : "時刻未定"}
                        {s.opponent ? ` ・ vs ${s.opponent}` : ""}
                        {s.place ? ` ・ ${s.place}` : ""}
                      </span>
                    </div>
                  </div>

                  {(attendance.length > 0 || notResponded.length > 0) && (
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:pl-4">
                      {(["出席", "欠席", "未定"] as const).map((key) =>
                        counts[key] > 0 ? (
                          <span
                            key={key}
                            className={`rounded px-1.5 py-0.5 text-xs font-bold ${STATUS_CLASS[key]}`}
                          >
                            {key} {counts[key]}
                          </span>
                        ) : null
                      )}
                      {notResponded.length > 0 && (
                        <details className="text-xs">
                          <summary className="inline-block cursor-pointer select-none rounded bg-surface-muted px-1.5 py-0.5 font-bold text-foreground/50 hover:text-foreground">
                            未回答 {notResponded.length}
                          </summary>
                          <p className="mt-1 max-w-40 text-foreground/50">
                            {notResponded.map((p) => p.name).join("、")}
                          </p>
                        </details>
                      )}
                    </div>
                  )}
                </div>

                {s.notes && (
                  <details className="text-xs text-foreground/60">
                    <summary className="cursor-pointer select-none text-foreground/50 hover:text-foreground">
                      詳細メモ
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-surface-muted p-2">{s.notes}</p>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
