"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import {
  buildGameRow,
  buildPitchingRows,
  buildPlateResult,
  buildSupportRows,
  newPlayerNamesFromPayload,
  resolvePlayerId,
  toIntOrNull,
  validateGamePayload,
  type GameFormPayload,
} from "@/lib/games/buildGameRows";
import type { PlateResult } from "@/types/plateResult";

export type UpdateGameState = { error: string } | undefined;

export async function updateGame(
  gameId: string,
  _prevState: UpdateGameState,
  formData: FormData
): Promise<UpdateGameState> {
  await requireAdmin(`/games/${gameId}/edit`);

  let payload: GameFormPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "フォームデータの読み取りに失敗しました。" };
  }

  const validationError = validateGamePayload(payload);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  // --- 新規選手のupsert（batting/pitchingのFK先になるため先に登録） ---
  const newPlayerNames = newPlayerNamesFromPayload(payload);
  if (newPlayerNames.size > 0) {
    const rows = [...newPlayerNames].map((name) => ({ id: name, name }));
    const { error: playersError } = await supabase
      .from("players")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (playersError) {
      return { error: "選手の新規登録に失敗しました: " + playersError.message };
    }
  }

  const { id: _id, ...gameFields } = buildGameRow(gameId, payload);
  const { error: gameError } = await supabase.from("games").update(gameFields).eq("id", gameId);
  if (gameError) {
    return { error: "試合の更新に失敗しました: " + gameError.message };
  }

  // --- 打者成績（全置換: 既存行を削除してから作り直す） ---
  const battingRows = payload.batters.map((b) => {
    const plateResults = b.plateResults
      .map(buildPlateResult)
      .filter((v): v is PlateResult => v !== null);
    const calc = calcBatting(plateResults);
    return {
      game_id: gameId,
      player_id: resolvePlayerId(b.player)!,
      order_no: toIntOrNull(b.orderNo),
      position: b.position.trim() || null,
      plate_results: plateResults,
      plate_appearances: calc.pa,
      at_bats: calc.ab,
      hits: calc.hits,
      runs: calc.runs,
      rbi: calc.rbi,
      steals: calc.steals,
    };
  });

  const { error: battingDeleteError } = await supabase
    .from("game_batting_stats")
    .delete()
    .eq("game_id", gameId);
  if (battingDeleteError) {
    return { error: "打撃成績の更新に失敗しました: " + battingDeleteError.message };
  }
  const { error: battingError } = await supabase.from("game_batting_stats").insert(battingRows);
  if (battingError) {
    return {
      error:
        "打撃成績の登録に失敗しました（既存データは削除済みです）: " + battingError.message,
    };
  }

  // --- 投手成績（全置換） ---
  const { error: pitchingDeleteError } = await supabase
    .from("game_pitching_stats")
    .delete()
    .eq("game_id", gameId);
  if (pitchingDeleteError) {
    return { error: "投手成績の更新に失敗しました: " + pitchingDeleteError.message };
  }
  const { error: pitchingError } = await supabase
    .from("game_pitching_stats")
    .insert(buildPitchingRows(gameId, payload));
  if (pitchingError) {
    return {
      error:
        "投手成績の登録に失敗しました（既存データは削除済みです）: " + pitchingError.message,
    };
  }

  // --- サポート実績（全置換。任意項目のため0件でも正常） ---
  const { error: supportDeleteError } = await supabase
    .from("support_stats")
    .delete()
    .eq("game_id", gameId);
  if (supportDeleteError) {
    return { error: "サポート実績の更新に失敗しました: " + supportDeleteError.message };
  }
  const supportRows = buildSupportRows(gameId, payload);
  if (supportRows.length > 0) {
    const { error: supportError } = await supabase.from("support_stats").insert(supportRows);
    if (supportError) {
      return {
        error:
          "サポート実績の登録に失敗しました（既存データは削除済みです）: " + supportError.message,
      };
    }
  }

  revalidatePath("/games");
  revalidatePath("/stats");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}
