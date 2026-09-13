import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuth, getCurrentPlayer } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import type { TeamSchedule } from "@/types/schedule";
import AttendanceForm from "../AttendanceForm";
import DeleteScheduleButton from "./DeleteScheduleButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

type AttendanceValue = "出席" | "欠席" | "未定";
type AttendanceRow = { player_id: string; attendance: AttendanceValue };
type PlayerRow = { id: string; name: string; is_guest: boolean };

const STATUS_CLASS: Record<AttendanceValue, string> = {
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

export default async function ScheduleDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireAuth(`/schedule/${id}`);

  const { data: schedule, error } = await supabase
    .from("team_schedule")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !schedule) {
    notFound();
  }
  const s = schedule as TeamSchedule;

  const player = await getCurrentPlayer();
  const sessionSupabase = await createServerClient();

  const [{ data: attendanceRows }, { data: players }] = await Promise.all([
    sessionSupabase.from("schedule_attendance").select("player_id, attendance").eq("schedule_id", id),
    fetchAllRows<PlayerRow>((from, to) =>
      supabase.from("players").select("id, name, is_guest").range(from, to)
    ),
  ]);

  const nameById = new Map((players ?? []).map((p) => [p.id, p.name]));
  const nonGuestPlayers = (players ?? []).filter((p) => !p.is_guest);

  const byStatus: Record<AttendanceValue, string[]> = { 出席: [], 欠席: [], 未定: [] };
  const respondedIds = new Set<string>();
  let myAttendance: AttendanceValue | null = null;
  for (const row of (attendanceRows ?? []) as AttendanceRow[]) {
    respondedIds.add(row.player_id);
    byStatus[row.attendance].push(nameById.get(row.player_id) ?? row.player_id);
    if (row.player_id === player?.id) myAttendance = row.attendance;
  }
  const notResponded = nonGuestPlayers
    .filter((p) => !respondedIds.has(p.id))
    .map((p) => p.name);

  const { weekday, label } = formatDate(s.date);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/schedule" className="text-sm text-foreground/50 hover:text-foreground">
          ← スケジュールに戻る
        </Link>
        {player?.is_admin && (
          <div className="flex items-center gap-2">
            <Link
              href={`/schedule/${id}/edit`}
              className="rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-surface-muted"
            >
              編集
            </Link>
            <DeleteScheduleButton scheduleId={id} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-surface-muted py-2">
            <span className="text-xs font-medium text-foreground/50">{weekday}</span>
            <span className="text-xl font-bold tabular-nums">{label}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {s.status && (
                <span className="rounded bg-team-gold-soft px-1.5 py-0.5 text-xs font-bold text-team-gold">
                  {s.status}
                </span>
              )}
              <span className="text-lg font-bold">{s.title}</span>
            </div>
            <span className="text-sm text-foreground/50">
              {s.start_time ? s.start_time.slice(0, 5) : "時刻未定"}
              {s.end_time ? `〜${s.end_time.slice(0, 5)}` : ""}
              {s.opponent ? ` ・ vs ${s.opponent}` : ""}
              {s.place ? ` ・ ${s.place}` : ""}
            </span>
            {s.umpire && <span className="text-xs text-foreground/50">審判: {s.umpire}</span>}
            {s.deadline && <span className="text-xs text-foreground/50">回答期限: {s.deadline}</span>}
          </div>
        </div>

        {player && <AttendanceForm scheduleId={id} current={myAttendance} />}

        {s.notes && (
          <div className="rounded-md bg-surface-muted p-3 text-sm whitespace-pre-wrap text-foreground/70">
            {s.notes}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">出欠状況</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["出席", "欠席", "未定"] as const).map((status) => (
            <div key={status} className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4">
              <span className={`w-fit rounded px-1.5 py-0.5 text-xs font-bold ${STATUS_CLASS[status]}`}>
                {status} {byStatus[status].length}
              </span>
              {byStatus[status].length === 0 ? (
                <span className="text-xs text-foreground/40">なし</span>
              ) : (
                <ul className="flex flex-col gap-0.5 text-sm">
                  {byStatus[status].map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {notResponded.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4">
            <span className="w-fit rounded bg-surface-muted px-1.5 py-0.5 text-xs font-bold text-foreground/50">
              未回答 {notResponded.length}
            </span>
            <p className="text-sm text-foreground/70">{notResponded.join("、")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
