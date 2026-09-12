"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type UpdateToolState = { error: string } | undefined;

export async function updateTool(
  toolId: string,
  _prevState: UpdateToolState,
  formData: FormData
): Promise<UpdateToolState> {
  await requireAdmin(`/tools/${toolId}/edit`);

  const toolName = String(formData.get("toolName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const ownerPlayerId = String(formData.get("ownerPlayerId") ?? "").trim();

  if (!toolName) {
    return { error: "道具名を入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_tools")
    .update({
      tool_name: toolName,
      description: description || null,
      image_url: imageUrl || null,
      owner_player_id: ownerPlayerId || null,
    })
    .eq("id", toolId);
  if (error) {
    return { error: "道具の更新に失敗しました: " + error.message };
  }

  revalidatePath("/tools");
  redirect("/tools");
}
