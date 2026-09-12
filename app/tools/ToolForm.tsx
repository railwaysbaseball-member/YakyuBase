"use client";

import { useActionState } from "react";

import { createTool } from "@/lib/tools/createTool";
import { updateTool } from "@/lib/tools/updateTool";

type PlayerOption = { id: string; name: string; number: number | null };

const inputClass =
  "rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red";

export default function ToolForm({
  players,
  mode = "create",
  toolId,
  initialData,
}: {
  players: PlayerOption[];
  mode?: "create" | "edit";
  toolId?: string;
  initialData?: {
    toolName: string;
    description: string;
    imageUrl: string;
    ownerPlayerId: string;
  };
}) {
  const boundAction = mode === "edit" ? updateTool.bind(null, toolId!) : createTool;
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        道具名
        <input
          type="text"
          name="toolName"
          required
          defaultValue={initialData?.toolName}
          placeholder="例: バット、ヘルメット、スコアブック"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        説明
        <textarea
          name="description"
          rows={4}
          defaultValue={initialData?.description}
          placeholder="状態、保管場所、注意事項など"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        画像URL
        <input
          type="text"
          name="imageUrl"
          defaultValue={initialData?.imageUrl}
          placeholder="https://..."
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        管理者（現在の持ち主）
        <select name="ownerPlayerId" defaultValue={initialData?.ownerPlayerId ?? ""} className={inputClass}>
          <option value="">未設定</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number != null ? `${p.number} ` : ""}
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {state?.error && <p className="text-sm text-loss">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50"
      >
        {pending ? "保存中..." : mode === "edit" ? "変更を保存" : "道具を登録"}
      </button>
    </form>
  );
}
