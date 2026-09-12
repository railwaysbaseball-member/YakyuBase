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
  risp: boolean;
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

export type SupportRole =
  | "participate"
  | "manage"
  | "bench"
  | "score"
  | "umpire"
  | "camera"
  | "watch"
  | "cheer";

export const SUPPORT_ROLES: { key: SupportRole; label: string }[] = [
  { key: "participate", label: "参加" },
  { key: "manage", label: "采配" },
  { key: "bench", label: "控え" },
  { key: "score", label: "スコア" },
  { key: "umpire", label: "審判" },
  { key: "camera", label: "撮影" },
  { key: "watch", label: "見学" },
  { key: "cheer", label: "応援" },
];

export type SupportDraft = {
  player: PlayerRef;
  roles: Record<SupportRole, boolean>;
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
  support: SupportDraft[];
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

  const rbi = Number(d.rbi) || 0;
  const steal = Number(d.steal) || 0;

  return {
    inning,
    result,
    ...(d.run ? { run: true } : {}),
    ...(rbi > 0 ? { rbi } : {}),
    ...(steal > 0 ? { steal } : {}),
    ...(d.risp ? { risp: true } : {}),
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

  const resolvedSupportIds = payload.support
    .map((s) => resolvePlayerId(s.player))
    .filter((id): id is string => id !== null);
  if (new Set(resolvedSupportIds).size !== resolvedSupportIds.length) {
    return "同じ選手がサポートに複数回登録されています。";
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
  for (const s of payload.support) {
    if (s.player.mode === "new") names.add(s.player.newName.trim());
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

/**
 * 選手が未選択、または役割が1つも選ばれていない行はサポート実績として
 * 意味を持たないので、insert対象から静かに除外する（打者/投手と違い
 * サポートは完全に任意項目のため、空行を残しておきたいUI都合上バリデー
 * ションエラーにはしない）。
 */
export function buildSupportRows(gameId: string, payload: GameFormPayload) {
  return payload.support
    .map((s) => {
      const playerId = resolvePlayerId(s.player);
      if (!playerId) return null;
      const hasAnyRole = SUPPORT_ROLES.some(({ key }) => s.roles[key]);
      if (!hasAnyRole) return null;

      const row: { game_id: string; player_id: string } & Record<SupportRole, number> = {
        game_id: gameId,
        player_id: playerId,
        participate: 0,
        manage: 0,
        bench: 0,
        score: 0,
        umpire: 0,
        camera: 0,
        watch: 0,
        cheer: 0,
      };
      for (const { key } of SUPPORT_ROLES) row[key] = s.roles[key] ? 1 : 0;
      return row;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
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
