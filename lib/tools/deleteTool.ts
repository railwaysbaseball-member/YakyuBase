"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type DeleteToolState = { error: string } | undefined;

export async function deleteTool(
  toolId: string,
  _prevState: DeleteToolState,
  _formData: FormData
): Promise<DeleteToolState> {
  await requireAdmin("/tools");

  const supabase = await createClient();
  const { error } = await supabase.from("team_tools").delete().eq("id", toolId);
  if (error) {
    return { error: "道具の削除に失敗しました: " + error.message };
  }

  revalidatePath("/tools");
  redirect("/tools");
}
