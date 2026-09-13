"use client";

import { useActionState } from "react";

import { createSchedule } from "@/lib/schedule/createSchedule";
import { updateSchedule } from "@/lib/schedule/updateSchedule";
import { SCHEDULE_EVENT_TYPES } from "@/lib/schedule/scheduleEventTypes";
import type { TeamSchedule } from "@/types/schedule";

const inputClass =
  "rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red";

export default function ScheduleForm({
  mode = "create",
  scheduleId,
  initial,
  opponentOptions,
  placeOptions,
}: {
  mode?: "create" | "edit";
  scheduleId?: string;
  initial?: TeamSchedule;
  opponentOptions: string[];
  placeOptions: string[];
}) {
  const action = mode === "edit" ? updateSchedule.bind(null, scheduleId!) : createSchedule;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
          <input type="date" name="date" required defaultValue={initial?.date ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          開始時刻
          <input
            type="time"
            name="startTime"
            defaultValue={initial?.start_time?.slice(0, 5) ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          終了時刻
          <input
            type="time"
            name="endTime"
            defaultValue={initial?.end_time?.slice(0, 5) ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          種別
          <select name="status" required defaultValue={initial?.status ?? ""} className={inputClass}>
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
          defaultValue={initial?.title ?? ""}
          placeholder="例: 淀川おむすびリーグ第3節、忘年会 など"
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          対戦相手
          <input
            type="text"
            name="opponent"
            list="schedule-opponent-options"
            defaultValue={initial?.opponent ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          場所
          <input
            type="text"
            name="place"
            list="schedule-place-options"
            defaultValue={initial?.place ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          出欠締切
          <input type="date" name="deadline" defaultValue={initial?.deadline ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          審判担当
          <input type="text" name="umpire" defaultValue={initial?.umpire ?? ""} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        詳細メモ
        <textarea
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ""}
          placeholder="持ち物、集合場所の補足、注意事項など"
          className={inputClass}
        />
      </label>

      {state?.error && <p className="text-sm text-loss">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50"
      >
        {pending ? (mode === "edit" ? "更新中..." : "登録中...") : mode === "edit" ? "予定を更新" : "予定を登録"}
      </button>
    </form>
  );
}
