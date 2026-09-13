"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type DeleteSeasonParametersState = { error: string } | undefined;

export async function deleteSeasonParameters(
  id: string,
  _prevState: DeleteSeasonParametersState,
  _formData: FormData
): Promise<DeleteSeasonParametersState> {
  await requireAdmin("/admin/season-parameters");

  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("season_parameters")
    .select("season")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    return { error: "年度設定の取得に失敗しました: " + fetchError.message };
  }
  if (row?.season === 0) {
    return { error: "全年度共通のデフォルト設定（年度0）は削除できません。" };
  }

  const { error } = await supabase.from("season_parameters").delete().eq("id", id);
  if (error) {
    return { error: "年度設定の削除に失敗しました: " + error.message };
  }

  revalidatePath("/admin/season-parameters");
  revalidatePath("/stats");
  redirect("/admin/season-parameters");
}
