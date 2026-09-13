"use client";

import { useActionState } from "react";

import { createSeasonParameters } from "@/lib/seasonParameters/createSeasonParameters";
import { updateSeasonParameters } from "@/lib/seasonParameters/updateSeasonParameters";
import { SEASON_PARAMETER_GROUPS, type SeasonParameterField } from "@/lib/seasonParameters/fields";

const inputClass =
  "rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red";

export default function SeasonParametersForm({
  mode = "create",
  id,
  initialData,
}: {
  mode?: "create" | "edit";
  id?: string;
  initialData?: { season: number } & Partial<Record<SeasonParameterField, number | null>>;
}) {
  const boundAction = mode === "edit" ? updateSeasonParameters.bind(null, id!) : createSeasonParameters;
  const [state, action, pending] = useActionState(boundAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        年度（全年度共通のデフォルトは 0）
        <input
          type="number"
          name="season"
          required
          readOnly={mode === "edit"}
          defaultValue={initialData?.season}
          className={`${inputClass} ${mode === "edit" ? "opacity-60" : ""} w-32`}
        />
      </label>

      {SEASON_PARAMETER_GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-3 rounded-xl border border-border-subtle p-4">
          <legend className="px-1 text-sm font-semibold">{group.title}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {group.fields.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1 text-xs">
                {label}
                <input
                  type="number"
                  step="any"
                  name={key}
                  defaultValue={initialData?.[key] ?? undefined}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {state?.error && <p className="text-sm text-loss">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50"
      >
        {pending ? "保存中..." : mode === "edit" ? "変更を保存" : "年度設定を登録"}
      </button>
    </form>
  );
}
