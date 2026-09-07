"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import { nextGameId } from "@/lib/games/generateGameId";
import type { PlateResult } from "@/types/plateResult";

export type PlayerRef = {
  mode: "existing" | "new";
  playerId: string;
  newName: string;
};

export type PlateResultDraft = {
  inning: string;
  result: string;
  run: boolean;
  rbi: string;
  steal: string;
  risp2: boolean;
  risp3: boolean;
  advancingHit: boolean;
  caughtStealing: boolean;
  pickedOff: boolean;
  doublePlay: boolean;
};

export type BatterDraft = {
  player: PlayerRef;
  orderNo: string;
  position: string;
  plateResults: PlateResultDraft[];
};

export type PitcherDraft = {
  player: PlayerRef;
  isStarter: boolean;
  inningsWhole: string;
  inningsOuts: string;
  er: string;
  runs: string;
  battersFaced: string;
  strikeouts: string;
  walks: string;
  hbp: string;
  hitsAllowed: string;
  hrAllowed: string;
  pitches: string;
  wp: string;
  balk: string;
  decision: "" | "W" | "L" | "S" | "H";
};

export type GameFormPayload = {
  date: string;
  startTime: string;
  endTime: string;
  league: string;
  stadium: string;
  opponent: string;
  inningsTeam: string[];
  inningsOpponent: string[];
  batters: BatterDraft[];
  pitchers: PitcherDraft[];
};

export type CreateGameState = { error: string } | undefined;

function resolvePlayerId(ref: PlayerRef): string | null {
  const raw = ref.mode === "existing" ? ref.playerId : ref.newName;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toInningCell(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function sumInnings(cells: (number | null)[]): number {
  return cells.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function buildPlateResult(d: PlateResultDraft): PlateResult | null {
  const inning = Number(d.inning);
  const result = d.result.trim();
  if (!Number.isInteger(inning) || inning <= 0 || !result) return null;

  const runnersOn: number[] = [];
  if (d.risp2) runnersOn.push(2);
  if (d.risp3) runnersOn.push(3);

  const rbi = Number(d.rbi) || 0;
  const steal = Number(d.steal) || 0;

  return {
    inning,
    result,
    ...(d.run ? { run: true } : {}),
    ...(rbi > 0 ? { rbi } : {}),
    ...(steal > 0 ? { steal } : {}),
    ...(runnersOn.length > 0 ? { runners_on: runnersOn } : {}),
    ...(d.advancingHit ? { advancing_hit: true } : {}),
    ...(d.caughtStealing ? { caught_stealing: true } : {}),
    ...(d.pickedOff ? { picked_off: true } : {}),
    ...(d.doublePlay ? { double_play: true } : {}),
  };
}

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

  // --- バリデーション ---
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return { error: "日付を正しく入力してください。" };
  }
  if (!payload.opponent.trim()) {
    return { error: "対戦相手を入力してください。" };
  }
  if (payload.batters.length === 0) {
    return { error: "打者を1人以上入力してください。" };
  }
  if (payload.pitchers.length === 0) {
    return { error: "投手を1人以上入力してください。" };
  }

  const resolvedBatterIds: string[] = [];
  for (const b of payload.batters) {
    const id = resolvePlayerId(b.player);
    if (!id) return { error: "打者の選手が未選択、または新規選手名が未入力です。" };
    resolvedBatterIds.push(id);

    if (b.plateResults.length === 0) {
      return { error: `${id}の打席が1件もありません。` };
    }
    for (const pr of b.plateResults) {
      if (!buildPlateResult(pr)) {
        return { error: `${id}の打席入力に不備があります（イニング・結果は必須です）。` };
      }
    }
  }
  if (new Set(resolvedBatterIds).size !== resolvedBatterIds.length) {
    return { error: "同じ選手が打者に複数回登録されています。" };
  }

  const resolvedPitcherIds: string[] = [];
  for (const p of payload.pitchers) {
    const id = resolvePlayerId(p.player);
    if (!id) return { error: "投手の選手が未選択、または新規選手名が未入力です。" };
    resolvedPitcherIds.push(id);
  }
  if (new Set(resolvedPitcherIds).size !== resolvedPitcherIds.length) {
    return { error: "同じ選手が投手に複数回登録されています。" };
  }
  const starterCount = payload.pitchers.filter((p) => p.isStarter).length;
  if (starterCount !== 1) {
    return { error: "先発投手をちょうど1人指定してください。" };
  }

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
  const newPlayerNames = new Set<string>();
  for (const b of payload.batters) {
    if (b.player.mode === "new") newPlayerNames.add(b.player.newName.trim());
  }
  for (const p of payload.pitchers) {
    if (p.player.mode === "new") newPlayerNames.add(p.player.newName.trim());
  }
  if (newPlayerNames.size > 0) {
    const rows = [...newPlayerNames].map((name) => ({ id: name, name }));
    const { error: playersError } = await supabase
      .from("players")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (playersError) {
      return { error: "選手の新規登録に失敗しました: " + playersError.message };
    }
  }

  // --- スコアボード ---
  const inningsTeam = payload.inningsTeam.map(toInningCell);
  const inningsOpponent = payload.inningsOpponent.map(toInningCell);
  const scoreboard = {
    innings: { team: inningsTeam, opponent: inningsOpponent },
    total: { team: sumInnings(inningsTeam), opponent: sumInnings(inningsOpponent) },
  };

  const { error: gameError } = await supabase.from("games").insert({
    id: gameId,
    date: payload.date,
    start_time: payload.startTime || null,
    end_time: payload.endTime || null,
    league: payload.league || null,
    stadium: payload.stadium || null,
    opponent: payload.opponent.trim(),
    scoreboard,
  });
  if (gameError) {
    return { error: "試合の登録に失敗しました: " + gameError.message };
  }

  // --- 打者成績 ---
  const battingRows = payload.batters.map((b, i) => {
    const plateResults = b.plateResults
      .map(buildPlateResult)
      .filter((v): v is PlateResult => v !== null);
    const calc = calcBatting(plateResults);
    return {
      game_id: gameId,
      player_id: resolvedBatterIds[i],
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
  const pitchingRows = payload.pitchers.map((p, i) => ({
    game_id: gameId,
    player_id: resolvedPitcherIds[i],
    innings: Number(`${p.inningsWhole || "0"}.${p.inningsOuts || "0"}`),
    er: toIntOrNull(p.er),
    runs: toIntOrNull(p.runs),
    batters_faced: toIntOrNull(p.battersFaced),
    strikeouts: toIntOrNull(p.strikeouts),
    walks: toIntOrNull(p.walks),
    hbp: toIntOrNull(p.hbp),
    hits_allowed: toIntOrNull(p.hitsAllowed),
    hr_allowed: toIntOrNull(p.hrAllowed),
    pitches: toIntOrNull(p.pitches),
    wp: toIntOrNull(p.wp),
    balk: toIntOrNull(p.balk),
    decision: p.decision || null,
    is_starter: p.isStarter,
  }));

  const { error: pitchingError } = await supabase.from("game_pitching_stats").insert(pitchingRows);
  if (pitchingError) {
    await supabase.from("game_batting_stats").delete().eq("game_id", gameId);
    await supabase.from("games").delete().eq("id", gameId);
    return { error: "投手成績の登録に失敗しました: " + pitchingError.message };
  }

  revalidatePath("/games");
  revalidatePath("/stats");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}
