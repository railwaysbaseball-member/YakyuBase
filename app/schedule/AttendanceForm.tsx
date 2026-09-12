"use client";

import { useActionState } from "react";

import { setAttendance } from "@/lib/schedule/setAttendance";

type AttendanceValue = "出席" | "欠席" | "未定";

const OPTIONS: AttendanceValue[] = ["出席", "欠席", "未定"];

const ACTIVE_CLASS: Record<AttendanceValue, string> = {
  出席: "bg-win text-white",
  欠席: "bg-loss text-white",
  未定: "bg-draw text-white",
};

export default function AttendanceForm({
  scheduleId,
  current,
}: {
  scheduleId: string;
  current: AttendanceValue | null;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-foreground/50">あなたの出欠:</span>
      {OPTIONS.map((opt) => (
        <AttendanceButton key={opt} scheduleId={scheduleId} value={opt} active={current === opt} />
      ))}
    </div>
  );
}

function AttendanceButton({
  scheduleId,
  value,
  active,
}: {
  scheduleId: string;
  value: AttendanceValue;
  active: boolean;
}) {
  const boundAction = setAttendance.bind(null, scheduleId, value);
  const [, action, pending] = useActionState(boundAction, undefined);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className={`rounded px-2 py-0.5 text-xs font-bold transition-colors disabled:opacity-50 ${
          active ? ACTIVE_CLASS[value] : "bg-surface-muted text-foreground/60 hover:bg-border-subtle"
        }`}
      >
        {value}
      </button>
    </form>
  );
}
