"use client";

import { useActionState } from "react";

import { createSchedule } from "@/lib/schedule/createSchedule";
import { SCHEDULE_EVENT_TYPES } from "@/lib/schedule/scheduleEventTypes";

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
        <label className="flex flex-col gap-1 text-sm">
          種別
          <select name="status" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              選択してください
            </option>
            {SCHEDULE_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        内容
        <input
          type="text"
          name="title"
          required
          placeholder="例: 淀川おむすびリーグ第3節、忘年会 など"
          className={inputClass}
        />
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
