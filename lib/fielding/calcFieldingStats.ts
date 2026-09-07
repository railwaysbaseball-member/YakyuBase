import type { FieldingStats } from "@/types/fielding";

export type CalculatedFielding = {
  games: number; // 試合

  putout: number; // 刺殺
  assist: number; // 補殺
  error: number; // 失策
  beauty: number; // 美技
  rarePlay: number; // 珍技

  chances: number; // 守備機会（刺殺+補殺+失策）
  fieldingPct: number; // 守備率
};

export function calcFielding(rows: FieldingStats[]): CalculatedFielding {
  let putout = 0;
  let assist = 0;
  let error = 0;
  let beauty = 0;
  let rarePlay = 0;

  for (const row of rows) {
    putout += row.putout ?? 0;
    assist += row.assist ?? 0;
    error += row.error ?? 0;
    beauty += row.beauty ?? 0;
    rarePlay += row.rare_play ?? 0;
  }

  const chances = putout + assist + error;
  const fieldingPct = chances > 0 ? (putout + assist) / chances : 0;

  return {
    games: rows.length,
    putout,
    assist,
    error,
    beauty,
    rarePlay,
    chances,
    fieldingPct,
  };
}
