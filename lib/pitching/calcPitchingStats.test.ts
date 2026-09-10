import { describe, expect, it } from "vitest";

import { calcPitching, formatInnings } from "./calcPitchingStats";
import type { PitchingStats } from "@/types/pitching";

function row(overrides: Partial<PitchingStats> = {}): PitchingStats {
  return {
    id: "id",
    game_id: "game",
    player_id: "p",
    innings: 0,
    er: 0,
    runs: 0,
    batters_faced: 0,
    strikeouts: 0,
    walks: 0,
    hbp: 0,
    hits_allowed: 0,
    hr_allowed: 0,
    pitches: 0,
    wp: 0,
    balk: 0,
    decision: null,
    is_starter: false,
    created_at: "",
    ...overrides,
  };
}

describe("formatInnings", () => {
  it("formats whole innings with no remainder", () => {
    expect(formatInnings(6)).toBe("2回");
  });
  it("formats a fractional-outs remainder", () => {
    expect(formatInnings(5)).toBe("1回2/3");
  });
  it("formats zero outs", () => {
    expect(formatInnings(0)).toBe("0回");
  });
});

describe("calcPitching", () => {
  it("returns all-zero stats for an empty row list", () => {
    const calc = calcPitching([]);
    expect(calc.games).toBe(0);
    expect(calc.era).toBe(0);
    expect(calc.whip).toBe(0);
  });

  it("converts the box-score outs notation (1.2 = 1 inning 2 outs) into a true out count", () => {
    // 1.2 (5 outs) + 2.1 (7 outs) = 12 outs total, not 1.2+2.1=3.3
    const calc = calcPitching([row({ innings: 1.2 }), row({ innings: 2.1 })]);
    expect(calc.outs).toBe(12);
    expect(calc.inningsReal).toBeCloseTo(4);
  });

  it("computes ERA/RA on a 7-inning basis, not 9", () => {
    // 63 ER over 67.2 innings (67*3+2=203 outs -> 203/3 = 67.667 real innings)
    // matches the real historical total row cross-checked earlier this session: ERA 6.52
    const calc = calcPitching([row({ innings: 67.2, er: 63, runs: 63 })]);
    expect(calc.era).toBeCloseTo((63 * 7) / (203 / 3), 1);
  });

  it("computes WHIP on the standard 1-inning basis (not 7)", () => {
    const calc = calcPitching([row({ innings: 3, walks: 2, hits_allowed: 1 })]);
    expect(calc.whip).toBeCloseTo((2 + 1) / 3);
  });

  it("counts decisions (W/L/S/H) from the decision field", () => {
    const calc = calcPitching([
      row({ decision: "W" }),
      row({ decision: "L" }),
      row({ decision: "S" }),
      row({ decision: "H" }),
      row({ decision: null }),
    ]);
    expect(calc.wins).toBe(1);
    expect(calc.losses).toBe(1);
    expect(calc.saves).toBe(1);
    expect(calc.holds).toBe(1);
  });

  it("only counts starts/QS for is_starter rows, using the default QS thresholds (6 innings, <=3 ER)", () => {
    const calc = calcPitching([
      row({ is_starter: true, innings: 6.0, er: 3 }), // meets threshold exactly -> QS
      row({ is_starter: true, innings: 5.2, er: 0 }), // under innings threshold -> not QS
      row({ is_starter: false, innings: 7.0, er: 0 }), // reliever, not counted toward starts/QS
    ]);
    expect(calc.starts).toBe(2);
    expect(calc.qs).toBe(1);
    expect(calc.qsRate).toBeCloseTo(50);
  });

  it("honors custom qsMinInnings/qsMaxEarnedRuns overrides (season_parameters per-season values)", () => {
    const rows = [row({ is_starter: true, innings: 3.0, er: 1 })];
    const default_ = calcPitching(rows);
    expect(default_.qs).toBe(0); // default min innings is 6, 3 innings doesn't qualify

    const custom = calcPitching(rows, { qsMinInnings: 3, qsMaxEarnedRuns: 1 });
    expect(custom.qs).toBe(1);
  });
});
