"use client";

import { useActionState } from "react";

import { updatePlayerStatus } from "@/lib/players/updatePlayerStatus";
import type { PlayerStatus } from "@/lib/players/playerStatus";

const STATUSES: { value: PlayerStatus; label: string; activeClass: string }[] = [
  { value: "active", label: "自チーム", activeClass: "bg-win/10 text-win" },
  { value: "guest", label: "助っ人", activeClass: "bg-team-gold-soft text-team-gold" },
  { value: "retired", label: "退会済み", activeClass: "bg-foreground/10 text-foreground/60" },
];

function StatusButton({
  playerId,
  target,
  label,
  activeClass,
  isCurrent,
}: {
  playerId: string;
  target: PlayerStatus;
  label: string;
  activeClass: string;
  isCurrent: boolean;
}) {
  const boundAction = updatePlayerStatus.bind(null, playerId, target);
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form action={action} className="contents">
      <button
        type="submit"
        disabled={isCurrent || pending}
        className={`rounded px-2 py-0.5 text-xs font-bold transition-colors disabled:cursor-default ${
          isCurrent ? activeClass : "text-foreground/40 underline hover:text-foreground"
        }`}
      >
        {label}
      </button>
      {state?.error && <span className="text-xs text-loss">{state.error}</span>}
    </form>
  );
}

export default function PlayerStatusToggle({
  playerId,
  status,
}: {
  playerId: string;
  status: PlayerStatus;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {STATUSES.map((s) => (
        <StatusButton
          key={s.value}
          playerId={playerId}
          target={s.value}
          label={s.label}
          activeClass={s.activeClass}
          isCurrent={status === s.value}
        />
      ))}
    </div>
  );
}
