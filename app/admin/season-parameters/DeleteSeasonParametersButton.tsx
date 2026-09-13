"use client";

import { useActionState } from "react";

import { deleteSeasonParameters } from "@/lib/seasonParameters/deleteSeasonParameters";

export default function DeleteSeasonParametersButton({ id }: { id: string }) {
  const boundAction = deleteSeasonParameters.bind(null, id);
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("この年度設定を削除します。よろしいですか？")) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-loss underline disabled:opacity-50"
      >
        {pending ? "削除中..." : "削除"}
      </button>
      {state?.error && <p className="text-xs text-loss">{state.error}</p>}
    </form>
  );
}
