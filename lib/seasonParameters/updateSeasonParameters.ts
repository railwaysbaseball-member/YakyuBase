"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { SEASON_PARAMETER_GROUPS, toNumOrNull } from "@/lib/seasonParameters/fields";

export type UpdateSeasonParametersState = { error: string } | undefined;

export async function updateSeasonParameters(
  id: string,
  _prevState: UpdateSeasonParametersState,
  formData: FormData
): Promise<UpdateSeasonParametersState> {
  await requireAdmin(`/admin/season-parameters/${id}/edit`);

  const fields: Record<string, number | null> = {};
  for (const group of SEASON_PARAMETER_GROUPS) {
    for (const { key } of group.fields) {
      fields[key] = toNumOrNull(formData.get(key));
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("season_parameters").update(fields).eq("id", id);
  if (error) {
    return { error: "年度設定の更新に失敗しました: " + error.message };
  }

  revalidatePath("/admin/season-parameters");
  revalidatePath("/stats");
  redirect("/admin/season-parameters");
}
