import { describe, expect, it } from "vitest";

import { calcFielding } from "./calcFieldingStats";
import type { FieldingStats } from "@/types/fielding";

function row(overrides: Partial<FieldingStats> = {}): FieldingStats {
  return {
    id: "id",
    game_id: "game",
    player_id: "p",
    putout: 0,
    assist: 0,
    error: 0,
    beauty: 0,
    rare_play: 0,
    created_at: "",
    ...overrides,
  };
}

describe("calcFielding", () => {
  it("returns all-zero stats for an empty row list, with no divide-by-zero", () => {
    const calc = calcFielding([]);
    expect(calc.games).toBe(0);
    expect(calc.chances).toBe(0);
    expect(calc.fieldingPct).toBe(0);
  });

  it("sums putout/assist/error/beauty/rarePlay across games", () => {
    const calc = calcFielding([
      row({ putout: 3, assist: 1, error: 0, beauty: 1, rare_play: 0 }),
      row({ putout: 2, assist: 2, error: 1, beauty: 0, rare_play: 1 }),
    ]);
    expect(calc.games).toBe(2);
    expect(calc.putout).toBe(5);
    expect(calc.assist).toBe(3);
    expect(calc.error).toBe(1);
    expect(calc.beauty).toBe(1);
    expect(calc.rarePlay).toBe(1);
  });

  it("computes chances as putout+assist+error and fieldingPct excluding errors from the numerator", () => {
    const calc = calcFielding([row({ putout: 8, assist: 2, error: 2 })]);
    expect(calc.chances).toBe(12);
    expect(calc.fieldingPct).toBeCloseTo((8 + 2) / 12);
  });
});
