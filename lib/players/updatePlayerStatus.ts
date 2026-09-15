"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type PlayerStatus = "active" | "guest" | "retired";

export type UpdatePlayerStatusState = { error: string } | undefined;

export async function updatePlayerStatus(
  playerId: string,
  status: PlayerStatus,
  _prevState: UpdatePlayerStatusState,
  _formData: FormData
): Promise<UpdatePlayerStatusState> {
  await requireAdmin("/players");

  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update({ is_guest: status === "guest", is_retired: status === "retired" })
    .eq("id", playerId);
  if (error) {
    return { error: "更新に失敗しました: " + error.message };
  }

  revalidatePath("/players");
  revalidatePath("/stats");
  revalidatePath("/schedule");
  revalidatePath("/");
}
