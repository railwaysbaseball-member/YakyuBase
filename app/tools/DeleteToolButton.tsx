"use client";

import { useActionState } from "react";

import { deleteTool } from "@/lib/tools/deleteTool";

export default function DeleteToolButton({ toolId }: { toolId: string }) {
  const boundAction = deleteTool.bind(null, toolId);
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("この道具を削除します。よろしいですか？")) {
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
