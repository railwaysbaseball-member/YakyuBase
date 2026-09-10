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

export function resolvePlayerId(ref: PlayerRef): string | null {
  const raw = ref.mode === "existing" ? ref.playerId : ref.newName;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toInningCell(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function sumInnings(cells: (number | null)[]): number {
  return cells.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

export function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function buildPlateResult(d: PlateResultDraft): PlateResult | null {
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

/**
 * createGame/updateGame 共通のバリデーション。問題が無ければ null、
 * あれば画面に出すエラーメッセージを返す。
 */
export function validateGamePayload(payload: GameFormPayload): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return "日付を正しく入力してください。";
  }
  if (!payload.opponent.trim()) {
    return "対戦相手を入力してください。";
  }
  if (payload.batters.length === 0) {
    return "打者を1人以上入力してください。";
  }
  if (payload.pitchers.length === 0) {
    return "投手を1人以上入力してください。";
  }

  const resolvedBatterIds: string[] = [];
  for (const b of payload.batters) {
    const id = resolvePlayerId(b.player);
    if (!id) return "打者の選手が未選択、または新規選手名が未入力です。";
    resolvedBatterIds.push(id);

    if (b.plateResults.length === 0) {
      return `${id}の打席が1件もありません。`;
    }
    for (const pr of b.plateResults) {
      if (!buildPlateResult(pr)) {
        return `${id}の打席入力に不備があります（イニング・結果は必須です）。`;
      }
    }
  }
  if (new Set(resolvedBatterIds).size !== resolvedBatterIds.length) {
    return "同じ選手が打者に複数回登録されています。";
  }

  const resolvedPitcherIds: string[] = [];
  for (const p of payload.pitchers) {
    const id = resolvePlayerId(p.player);
    if (!id) return "投手の選手が未選択、または新規選手名が未入力です。";
    resolvedPitcherIds.push(id);
  }
  if (new Set(resolvedPitcherIds).size !== resolvedPitcherIds.length) {
    return "同じ選手が投手に複数回登録されています。";
  }
  const starterCount = payload.pitchers.filter((p) => p.isStarter).length;
  if (starterCount !== 1) {
    return "先発投手をちょうど1人指定してください。";
  }

  return null;
}

export function newPlayerNamesFromPayload(payload: GameFormPayload): Set<string> {
  const names = new Set<string>();
  for (const b of payload.batters) {
    if (b.player.mode === "new") names.add(b.player.newName.trim());
  }
  for (const p of payload.pitchers) {
    if (p.player.mode === "new") names.add(p.player.newName.trim());
  }
  return names;
}

/**
 * バリデーション済みの payload から games/game_batting_stats/game_pitching_stats
 * へのinsert用オブジェクトを組み立てる（DBアクセスは行わない純粋関数）。
 * calcBatting は呼び出し側（Server Action）で行う — このファイルは
 * lib/batting に依存させたくない（batting集計ロジックの変更とデータ整形ロジックの
 * 変更を独立させるため）。
 */
export function buildGameRow(gameId: string, payload: GameFormPayload) {
  const inningsTeam = payload.inningsTeam.map(toInningCell);
  const inningsOpponent = payload.inningsOpponent.map(toInningCell);
  const scoreboard = {
    innings: { team: inningsTeam, opponent: inningsOpponent },
    total: { team: sumInnings(inningsTeam), opponent: sumInnings(inningsOpponent) },
  };

  return {
    id: gameId,
    date: payload.date,
    start_time: payload.startTime || null,
    end_time: payload.endTime || null,
    league: payload.league || null,
    stadium: payload.stadium || null,
    opponent: payload.opponent.trim(),
    scoreboard,
  };
}

export function buildPitchingRows(gameId: string, payload: GameFormPayload) {
  return payload.pitchers.map((p) => ({
    game_id: gameId,
    player_id: resolvePlayerId(p.player)!,
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
}
