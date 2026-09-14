"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/session";
import { calcBatting } from "@/lib/batting/calcBattingStats";
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

export type UpdateGameState = { error: string } | undefined;

type ReplaceTableName =
  | "game_batting_stats"
  | "game_pitching_stats"
  | "game_fielding_stats"
  | "support_stats";

// 指定テーブルの既存行(game_id一致分)を削除してから作り直す。delete/insertは
// テーブル内では順番が必要だが、テーブル間には依存が無いためPromise.allで並列に呼ぶ。
async function replaceTableRows(
  supabase: SupabaseClient,
  table: ReplaceTableName,
  gameId: string,
  rows: Record<string, unknown>[]
): Promise<{ phase: "delete" | "insert"; message: string } | null> {
  const { error: deleteError } = await supabase.from(table).delete().eq("game_id", gameId);
  if (deleteError) return { phase: "delete", message: deleteError.message };

  if (rows.length === 0) return null;

  const { error: insertError } = await supabase.from(table).insert(rows);
  if (insertError) return { phase: "insert", message: insertError.message };

  return null;
}

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
  // 試合本体の更新はFK依存が無いため、選手upsertと並列に実行する。
  const newPlayerNames = newPlayerNamesFromPayload(payload);
  const { id: _id, ...gameFields } = buildGameRow(gameId, payload);

  const [playersResult, gameResult] = await Promise.all([
    newPlayerNames.size > 0
      ? supabase
          .from("players")
          .upsert(
            [...newPlayerNames].map((name) => ({ id: name, name })),
            { onConflict: "id", ignoreDuplicates: true }
          )
      : Promise.resolve({ error: null }),
    supabase.from("games").update(gameFields).eq("id", gameId),
  ]);
  if (playersResult.error) {
    return { error: "選手の新規登録に失敗しました: " + playersResult.error.message };
  }
  if (gameResult.error) {
    return { error: "試合の更新に失敗しました: " + gameResult.error.message };
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

  // --- 打者/投手/守備/サポートの全置換をテーブルごとに並列実行 ---
  const [battingFailure, pitchingFailure, fieldingFailure, supportFailure] = await Promise.all([
    replaceTableRows(supabase, "game_batting_stats", gameId, battingRows),
    replaceTableRows(supabase, "game_pitching_stats", gameId, buildPitchingRows(gameId, payload)),
    replaceTableRows(supabase, "game_fielding_stats", gameId, buildFieldingRows(gameId, payload)),
    replaceTableRows(supabase, "support_stats", gameId, buildSupportRows(gameId, payload)),
  ]);

  const describeFailure = (label: string, f: NonNullable<typeof battingFailure>) =>
    f.phase === "delete"
      ? `${label}の更新に失敗しました: ${f.message}`
      : `${label}の登録に失敗しました（既存データは削除済みです）: ${f.message}`;

  if (battingFailure) return { error: describeFailure("打撃成績", battingFailure) };
  if (pitchingFailure) return { error: describeFailure("投手成績", pitchingFailure) };
  if (fieldingFailure) return { error: describeFailure("守備成績", fieldingFailure) };
  if (supportFailure) return { error: describeFailure("サポート実績", supportFailure) };

  revalidatePath("/games");
  revalidatePath("/stats");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}
