"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import { nextGameId } from "@/lib/games/generateGameId";
import {
  buildFieldingRows,
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
  FieldingDraft,
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
  // 試合本体の登録はFK依存が無いため、選手upsertと並列に実行する。
  const newPlayerNames = newPlayerNamesFromPayload(payload);

  const [playersResult, gameResult] = await Promise.all([
    newPlayerNames.size > 0
      ? supabase
          .from("players")
          .upsert(
            [...newPlayerNames].map((name) => ({ id: name, name })),
            { onConflict: "id", ignoreDuplicates: true }
          )
      : Promise.resolve({ error: null }),
    supabase.from("games").insert(buildGameRow(gameId, payload)),
  ]);
  if (playersResult.error) {
    return { error: "選手の新規登録に失敗しました: " + playersResult.error.message };
  }
  if (gameResult.error) {
    return { error: "試合の登録に失敗しました: " + gameResult.error.message };
  }

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
  const pitchingRows = buildPitchingRows(gameId, payload);
  const fieldingRows = buildFieldingRows(gameId, payload);
  const supportRows = buildSupportRows(gameId, payload);

  // --- 打者/投手/守備/サポートを並列でinsert（互いに依存が無いため） ---
  const [battingInsert, pitchingInsert, fieldingInsert, supportInsert] = await Promise.all([
    supabase.from("game_batting_stats").insert(battingRows),
    supabase.from("game_pitching_stats").insert(pitchingRows),
    fieldingRows.length > 0
      ? supabase.from("game_fielding_stats").insert(fieldingRows)
      : Promise.resolve({ error: null }),
    supportRows.length > 0
      ? supabase.from("support_stats").insert(supportRows)
      : Promise.resolve({ error: null }),
  ]);

  const insertError =
    battingInsert.error ?? pitchingInsert.error ?? fieldingInsert.error ?? supportInsert.error;

  if (insertError) {
    // 成功した分だけロールバックしてから、優先順位（打撃→投手→守備→サポート）で
    // 最初に見つかったエラーを報告する。
    await Promise.all([
      !battingInsert.error
        ? supabase.from("game_batting_stats").delete().eq("game_id", gameId)
        : Promise.resolve(),
      !pitchingInsert.error
        ? supabase.from("game_pitching_stats").delete().eq("game_id", gameId)
        : Promise.resolve(),
      !fieldingInsert.error
        ? supabase.from("game_fielding_stats").delete().eq("game_id", gameId)
        : Promise.resolve(),
      !supportInsert.error
        ? supabase.from("support_stats").delete().eq("game_id", gameId)
        : Promise.resolve(),
    ]);
    await supabase.from("games").delete().eq("id", gameId);

    if (battingInsert.error) {
      return { error: "打撃成績の登録に失敗しました: " + battingInsert.error.message };
    }
    if (pitchingInsert.error) {
      return { error: "投手成績の登録に失敗しました: " + pitchingInsert.error.message };
    }
    if (fieldingInsert.error) {
      return { error: "守備成績の登録に失敗しました: " + fieldingInsert.error.message };
    }
    return { error: "サポート実績の登録に失敗しました: " + supportInsert.error!.message };
  }

  revalidatePath("/games");
  revalidatePath("/stats");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}
