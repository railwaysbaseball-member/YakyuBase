import Link from "next/link";

import type { TeamSchedule } from "@/types/schedule";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y, monthIndex: m - 1 };
}

function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  const d = new Date(year, monthIndex + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ScheduleCalendar({
  schedules,
  month,
}: {
  schedules: TeamSchedule[];
  month: string; // "YYYY-MM"
}) {
  const { year, monthIndex } = parseMonth(month);
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const byDate = new Map<string, TeamSchedule[]>();
  for (const s of schedules) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthStr = todayStr.slice(0, 7);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/schedule?month=${shiftMonth(month, -1)}`}
          className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-surface-muted"
        >
          ＜ 前月
        </Link>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">
            {year}年{monthIndex + 1}月
          </h2>
          {month !== thisMonthStr && (
            <Link
              href={`/schedule?month=${thisMonthStr}`}
              className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground/60 hover:bg-border-subtle"
            >
              今月
            </Link>
          )}
        </div>
        <Link
          href={`/schedule?month=${shiftMonth(month, 1)}`}
          className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-surface-muted"
        >
          次月 ＞
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className="w-full min-w-max table-fixed text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {WEEKDAYS.map((w, i) => (
                <th
                  key={w}
                  className={`w-[14%] px-1 py-1.5 text-xs font-medium ${
                    i === 0 ? "text-loss" : i === 6 ? "text-sky-600" : "text-foreground/50"
                  }`}
                >
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi} className="border-t border-border-subtle">
                {week.map((day, di) => {
                  const dateStr = day
                    ? `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    : null;
                  const items = dateStr ? (byDate.get(dateStr) ?? []) : [];
                  const isToday = dateStr === todayStr;

                  return (
                    <td key={di} className="h-20 max-w-0 border-l border-border-subtle p-1 align-top first:border-l-0">
                      {day && (
                        <div className="flex h-full flex-col gap-0.5">
                          <span
                            className={`text-xs font-medium ${
                              isToday
                                ? "inline-flex h-4 w-4 items-center justify-center rounded-full bg-team-red text-white"
                                : "text-foreground/60"
                            }`}
                          >
                            {day}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            {items.map((s) => (
                              <a
                                key={s.id}
                                href={`#${s.id}`}
                                className="truncate rounded bg-team-red-soft px-1 py-0.5 text-[0.65rem] font-medium text-team-red hover:bg-team-red hover:text-white"
                                title={`${s.start_time ? s.start_time.slice(0, 5) + " " : ""}${s.title}`}
                              >
                                {s.start_time ? s.start_time.slice(0, 5) : ""} {s.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
