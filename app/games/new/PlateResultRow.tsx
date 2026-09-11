"use client";

import type { PlateResultDraft } from "@/lib/games/createGame";

const inputClass =
  "rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none focus:border-team-red";

export default function PlateResultRow({
  value,
  onChange,
  onRemove,
}: {
  value: PlateResultDraft;
  onChange: (next: PlateResultDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border-subtle bg-surface-muted p-1.5">
      <input
        type="number"
        min={1}
        placeholder="回"
        value={value.inning}
        onChange={(e) => onChange({ ...value, inning: e.target.value })}
        className={`${inputClass} w-14`}
      />
      <input
        type="text"
        list="plate-result-options"
        placeholder="結果（例: 中安）"
        value={value.result}
        onChange={(e) => onChange({ ...value, result: e.target.value })}
        className={`${inputClass} w-28`}
      />
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={value.run}
          onChange={(e) => onChange({ ...value, run: e.target.checked })}
        />
        得点
      </label>
      <label className="flex items-center gap-1 text-xs">
        打点
        <select
          value={value.rbi}
          onChange={(e) => onChange({ ...value, rbi: e.target.value })}
          className={inputClass}
        >
          {["0", "1", "2", "3", "4"].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs">
        盗塁
        <select
          value={value.steal}
          onChange={(e) => onChange({ ...value, steal: e.target.value })}
          className={inputClass}
        >
          {["0", "1", "2"].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={value.risp}
          onChange={(e) => onChange({ ...value, risp: e.target.checked })}
        />
        得点圏
      </label>

      <details className="text-xs">
        <summary className="cursor-pointer text-foreground/50">詳細</summary>
        <div className="mt-1 flex flex-wrap gap-2">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={value.advancingHit}
              onChange={(e) => onChange({ ...value, advancingHit: e.target.checked })}
            />
            進塁打
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={value.caughtStealing}
              onChange={(e) => onChange({ ...value, caughtStealing: e.target.checked })}
            />
            盗塁死
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={value.pickedOff}
              onChange={(e) => onChange({ ...value, pickedOff: e.target.checked })}
            />
            牽制死
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={value.doublePlay}
              onChange={(e) => onChange({ ...value, doublePlay: e.target.checked })}
            />
            併殺打
          </label>
        </div>
      </details>

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto text-xs text-loss underline"
      >
        削除
      </button>
    </div>
  );
}
