"use client";

import { useActionState } from "react";

import { updatePlayerGuest } from "@/lib/players/updatePlayerGuest";

export default function GuestToggle({ playerId, isGuest }: { playerId: string; isGuest: boolean }) {
  const boundAction = updatePlayerGuest.bind(null, playerId, !isGuest);
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form action={action} className="flex items-center gap-2">
      <span
        className={`rounded px-2 py-0.5 text-xs font-bold ${
          isGuest ? "bg-team-gold-soft text-team-gold" : "bg-win/10 text-win"
        }`}
      >
        {isGuest ? "助っ人" : "自チーム"}
      </span>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-foreground/50 underline hover:text-foreground disabled:opacity-50"
      >
        {pending ? "更新中..." : isGuest ? "自チームに戻す" : "助っ人にする"}
      </button>
      {state?.error && <span className="text-xs text-loss">{state.error}</span>}
    </form>
  );
}
