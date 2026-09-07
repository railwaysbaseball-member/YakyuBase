export type PitchingStats = {
  id: string;
  game_id: string;
  player_id: string;

  innings: number | null;
  er: number | null;
  runs: number | null;
  batters_faced: number | null;
  strikeouts: number | null;
  walks: number | null;
  hbp: number | null;
  hits_allowed: number | null;
  hr_allowed: number | null;
  pitches: number | null;
  wp: number | null;
  balk: number | null;
  /** "W" | "L" | "S" | "H" | null */
  decision: string | null;
  /** 先発投手として登板したか（QS判定に使用） */
  is_starter: boolean;

  created_at: string;
};
