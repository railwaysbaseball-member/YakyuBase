"use client";

import { useActionState } from "react";

import { createSchedule } from "@/lib/schedule/createSchedule";

const inputClass =
  "rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red";

export default function ScheduleForm({
  opponentOptions,
  placeOptions,
}: {
  opponentOptions: string[];
  placeOptions: string[];
}) {
  const [state, action, pending] = useActionState(createSchedule, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <datalist id="schedule-opponent-options">
        {opponentOptions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="schedule-place-options">
        {placeOptions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="schedule-status-options">
        <option value="開催" />
        <option value="中止" />
        <option value="延期" />
        <option value="未定" />
      </datalist>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          日付
          <input type="date" name="date" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          開始時刻
          <input type="time" name="startTime" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          終了時刻
          <input type="time" name="endTime" className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        予定名
        <input type="text" name="title" required placeholder="例: 練習試合、リーグ戦、納会" className={inputClass} />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          対戦相手
          <input type="text" name="opponent" list="schedule-opponent-options" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          場所
          <input type="text" name="place" list="schedule-place-options" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          状況
          <input type="text" name="status" list="schedule-status-options" className={inputClass} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          出欠締切
          <input type="date" name="deadline" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          審判担当
          <input type="text" name="umpire" className={inputClass} />
        </label>
      </div>

      {state?.error && <p className="text-sm text-loss">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50"
      >
        {pending ? "登録中..." : "予定を登録"}
      </button>
    </form>
  );
}
