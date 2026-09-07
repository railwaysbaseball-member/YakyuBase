import type { PlateResult } from "./plateResult";

export type BattingStats = {
  id: string;
  game_id: string;
  player_id: string;

  order_no: number | null;
  position: string | null;

  plate_results: PlateResult[];

  plate_appearances: number;
  at_bats: number;
  hits: number;
  runs: number;
  rbi: number;
  steals: number;

  // 派生計算用
  singles?: number;
  doubles?: number;
  triples?: number;
  homeruns?: number;

  // 進塁打など
  advancing_hits?: number;

  created_at: string;
};
