"use client";

import { useActionState } from "react";

import { deleteSchedule } from "@/lib/schedule/deleteSchedule";

export default function DeleteScheduleButton({ scheduleId }: { scheduleId: string }) {
  const boundAction = deleteSchedule.bind(null, scheduleId);
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("この予定を削除します。よろしいですか？")) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-loss/30 px-3 py-1.5 text-sm font-semibold text-loss transition-colors hover:bg-loss/10 disabled:opacity-50"
      >
        {pending ? "削除中..." : "削除"}
      </button>
      {state?.error && <p className="text-xs text-loss">{state.error}</p>}
    </form>
  );
}
