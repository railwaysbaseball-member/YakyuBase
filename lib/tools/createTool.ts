"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type CreateToolState = { error: string } | undefined;

export async function createTool(
  _prevState: CreateToolState,
  formData: FormData
): Promise<CreateToolState> {
  await requireAdmin("/tools/new");

  const toolName = String(formData.get("toolName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const ownerPlayerId = String(formData.get("ownerPlayerId") ?? "").trim();

  if (!toolName) {
    return { error: "道具名を入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("team_tools").insert({
    id: randomUUID(),
    tool_name: toolName,
    description: description || null,
    image_url: imageUrl || null,
    owner_player_id: ownerPlayerId || null,
  });
  if (error) {
    return { error: "道具の登録に失敗しました: " + error.message };
  }

  revalidatePath("/tools");
  redirect("/tools");
}
