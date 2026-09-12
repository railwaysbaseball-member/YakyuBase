"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import { nextGameId } from "@/lib/games/generateGameId";
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

export type {
  BatterDraft,
  GameFormPayload,
  PitcherDraft,
  PlateResultDraft,
  PlayerRef,
  SupportDraft,
} from "@/lib/games/buildGameRows";

export type CreateGameState = { error: string } | undefined;

export async function createGame(
  _prevState: CreateGameState,
  formData: FormData
): Promise<CreateGameState> {
  await requireAdmin("/games/new");

  let payload: GameFormPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "フォームデータの読み取りに失敗しました。" };
  }

  const validationError = validateGamePayload(payload);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  // --- 試合IDの採番 ---
  const dateCompact = payload.date.replaceAll("-", "");
  const { data: existingGames, error: existingGamesError } = await supabase
    .from("games")
    .select("id")
    .like("id", `game-${dateCompact}%`);
  if (existingGamesError) {
    return { error: "試合ID採番に失敗しました: " + existingGamesError.message };
  }
  const gameId = nextGameId(payload.date, (existingGames ?? []).map((g) => g.id as string));

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

  const { error: gameError } = await supabase.from("games").insert(buildGameRow(gameId, payload));
  if (gameError) {
    return { error: "試合の登録に失敗しました: " + gameError.message };
  }

  // --- 打者成績 ---
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

  const { error: battingError } = await supabase.from("game_batting_stats").insert(battingRows);
  if (battingError) {
    await supabase.from("games").delete().eq("id", gameId);
    return { error: "打撃成績の登録に失敗しました: " + battingError.message };
  }

  // --- 投手成績 ---
  const { error: pitchingError } = await supabase
    .from("game_pitching_stats")
    .insert(buildPitchingRows(gameId, payload));
  if (pitchingError) {
    await supabase.from("game_batting_stats").delete().eq("game_id", gameId);
    await supabase.from("games").delete().eq("id", gameId);
    return { error: "投手成績の登録に失敗しました: " + pitchingError.message };
  }

  // --- サポート実績（任意項目。1件も無ければ何もしない） ---
  const supportRows = buildSupportRows(gameId, payload);
  if (supportRows.length > 0) {
    const { error: supportError } = await supabase.from("support_stats").insert(supportRows);
    if (supportError) {
      await supabase.from("game_pitching_stats").delete().eq("game_id", gameId);
      await supabase.from("game_batting_stats").delete().eq("game_id", gameId);
      await supabase.from("games").delete().eq("id", gameId);
      return { error: "サポート実績の登録に失敗しました: " + supportError.message };
    }
  }

  revalidatePath("/games");
  revalidatePath("/stats");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}
