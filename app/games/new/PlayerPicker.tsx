"use client";

import type { PlayerRef } from "@/lib/games/createGame";

type PlayerOption = { id: string; name: string; number: number | null };

const NEW_PLAYER_VALUE = "__new__";

export default function PlayerPicker({
  players,
  value,
  onChange,
}: {
  players: PlayerOption[];
  value: PlayerRef;
  onChange: (next: PlayerRef) => void;
}) {
  const inputClass =
    "rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm outline-none focus:border-team-red";

  if (value.mode === "new") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          placeholder="新しい選手名"
          value={value.newName}
          onChange={(e) => onChange({ ...value, newName: e.target.value })}
          className={`${inputClass} w-28`}
        />
        <button
          type="button"
          onClick={() => onChange({ mode: "existing", playerId: "", newName: "" })}
          className="text-xs text-foreground/50 underline"
        >
          選択に戻す
        </button>
      </div>
    );
  }

  return (
    <select
      value={value.playerId}
      onChange={(e) => {
        if (e.target.value === NEW_PLAYER_VALUE) {
          onChange({ mode: "new", playerId: "", newName: "" });
        } else {
          onChange({ mode: "existing", playerId: e.target.value, newName: "" });
        }
      }}
      className={inputClass}
    >
      <option value="">選手を選択</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.number != null ? `${p.number} ` : ""}
          {p.name}
        </option>
      ))}
      <option value={NEW_PLAYER_VALUE}>＋ 新しい選手を追加</option>
    </select>
  );
}
