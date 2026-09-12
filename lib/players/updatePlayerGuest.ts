"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type UpdatePlayerGuestState = { error: string } | undefined;

export async function updatePlayerGuest(
  playerId: string,
  isGuest: boolean,
  _prevState: UpdatePlayerGuestState,
  _formData: FormData
): Promise<UpdatePlayerGuestState> {
  await requireAdmin("/players");

  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ is_guest: isGuest }).eq("id", playerId);
  if (error) {
    return { error: "更新に失敗しました: " + error.message };
  }

  revalidatePath("/players");
  revalidatePath("/stats");
}
