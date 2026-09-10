"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type DeleteGameState = { error: string } | undefined;

export async function deleteGame(
  gameId: string,
  _prevState: DeleteGameState,
  _formData: FormData
): Promise<DeleteGameState> {
  await requireAdmin("/games");

  const supabase = await createClient();

  const { error: battingError } = await supabase
    .from("game_batting_stats")
    .delete()
    .eq("game_id", gameId);
  if (battingError) {
    return { error: "打撃成績の削除に失敗しました: " + battingError.message };
  }

  const { error: pitchingError } = await supabase
    .from("game_pitching_stats")
    .delete()
    .eq("game_id", gameId);
  if (pitchingError) {
    return { error: "投手成績の削除に失敗しました: " + pitchingError.message };
  }

  const { error: gameError } = await supabase.from("games").delete().eq("id", gameId);
  if (gameError) {
    return { error: "試合の削除に失敗しました: " + gameError.message };
  }

  revalidatePath("/games");
  revalidatePath("/stats");
  redirect("/games");
}
