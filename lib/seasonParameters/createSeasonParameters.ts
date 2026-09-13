"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { SEASON_PARAMETER_GROUPS, toNumOrNull } from "@/lib/seasonParameters/fields";

export type CreateSeasonParametersState = { error: string } | undefined;

export async function createSeasonParameters(
  _prevState: CreateSeasonParametersState,
  formData: FormData
): Promise<CreateSeasonParametersState> {
  await requireAdmin("/admin/season-parameters/new");

  const seasonRaw = String(formData.get("season") ?? "").trim();
  const season = Number(seasonRaw);
  if (!seasonRaw || !Number.isInteger(season)) {
    return { error: "年度は整数で入力してください（全年度共通のデフォルトは 0）。" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("season_parameters")
    .select("id")
    .eq("season", season)
    .maybeSingle();
  if (existing) {
    return { error: `年度 ${season} の設定は既に存在します。編集画面から変更してください。` };
  }

  const fields: Record<string, number | null> = {};
  for (const group of SEASON_PARAMETER_GROUPS) {
    for (const { key } of group.fields) {
      fields[key] = toNumOrNull(formData.get(key));
    }
  }

  const { error } = await supabase.from("season_parameters").insert({
    id: randomUUID(),
    season,
    ...fields,
  });
  if (error) {
    return { error: "年度設定の登録に失敗しました: " + error.message };
  }

  revalidatePath("/admin/season-parameters");
  revalidatePath("/stats");
  redirect("/admin/season-parameters");
}
