import { describe, expect, it } from "vitest";

import { calcBatterPoint, calcPitcherPoint } from "./calcPoints";
import type { CalculatedBatting } from "@/lib/batting/calcBattingStats";
import type { CalculatedFielding } from "@/lib/fielding/calcFieldingStats";
import type { CalculatedPitching } from "@/lib/pitching/calcPitchingStats";
import type { SeasonParameters } from "@/types/seasonParameters";

// season=0（全年度共通）の実際の重み付け値
// (supabase/seed/season_parameters.sql に記録されている値と同一)
const PARAMS: SeasonParameters = {
  id: "id",
  season: 0,
  inning_count: 7,
  required_pa: 1.5,
  required_ip: 1,
  qs: 6,
  earned_runs: 3,
  strike_escape: 1,
  opponent_error: 1,
  interference: 1,
  fielder_choice: 1,
  walk: 3,
  hbp: 2,
  sac_bunt: 2,
  sac_fly: 4,
  infield_hit: 3,
  single: 4,
  double: 6,
  triple: 8,
  homerun: 10,
  steal: 2,
  run: 2,
  rbi: 3,
  plate_appearance: 1,
  advancing_hit: 0,
  picked_off: 0,
  caught_stealing: 0,
  beauty: 0,
  rare_play: 0,
  putout: 0,
  assist: 0,
  error: 0,
  win: 5,
  out: 1,
  strikeout: 2,
  walk_allowed: -1,
  hbp_allowed: -3,
  earned_run_allowed: -2,
  created_at: "",
};

function batting(overrides: Partial<CalculatedBatting> = {}): CalculatedBatting {
  return {
    pa: 0,
    ab: 0,
    hits: 0,
    singles: 0,
    infield_hits: 0,
    doubles: 0,
    triples: 0,
    homeruns: 0,
    runs: 0,
    rbi: 0,
    steals: 0,
    caught_stealing: 0,
    picked_off: 0,
    double_plays: 0,
    strikeouts: 0,
    walks: 0,
    hbp: 0,
    sac_bunt: 0,
    sac_fly: 0,
    sac: 0,
    advancing_hits: 0,
    strike_escapes: 0,
    opponent_errors: 0,
    interferences: 0,
    fielder_choices: 0,
    avg: 0,
    obp: 0,
    slg: 0,
    ops: 0,
    risp_ab: 0,
    risp_hits: 0,
    risp_avg: 0,
    rc27: 0,
    ...overrides,
  };
}

function fielding(overrides: Partial<CalculatedFielding> = {}): CalculatedFielding {
  return {
    games: 0,
    putout: 0,
    assist: 0,
    error: 0,
    beauty: 0,
    rarePlay: 0,
    chances: 0,
    fieldingPct: 0,
    ...overrides,
  };
}

function pitching(overrides: Partial<CalculatedPitching> = {}): CalculatedPitching {
  return {
    games: 0,
    starts: 0,
    outs: 0,
    innings: 0,
    inningsReal: 0,
    battersFaced: 0,
    hitsAllowed: 0,
    hrAllowed: 0,
    strikeouts: 0,
    walks: 0,
    hbp: 0,
    runs: 0,
    er: 0,
    pitches: 0,
    wp: 0,
    balk: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    holds: 0,
    qs: 0,
    qsRate: 0,
    era: 0,
    ra: 0,
    kRate: 0,
    bbHbpRate: 0,
    whip: 0,
    ...overrides,
  };
}

describe("calcBatterPoint", () => {
  it("returns 0 for an all-zero stat line", () => {
    expect(calcBatterPoint(batting(), fielding(), PARAMS)).toBe(0);
  });

  it("weights a single vs an infield hit differently (infield_hit takes priority over single)", () => {
    // singles=1, infield_hits=1 means 1 "pure" single (single - infield_hit) + 1 infield hit
    const b = batting({ singles: 1, infield_hits: 1, pa: 1 });
    const point = calcBatterPoint(b, fielding(), PARAMS);
    // (singles - infield_hits) * single_weight + infield_hits * infield_hit_weight + pa * pa_weight
    expect(point).toBe((1 - 1) * 4 + 1 * 3 + 1 * 1);
  });

  it("sums every weighted batting term for a realistic stat line", () => {
    const b = batting({
      pa: 4,
      singles: 1,
      doubles: 1,
      triples: 0,
      homeruns: 1,
      infield_hits: 0,
      walks: 1,
      hbp: 0,
      sac_bunt: 0,
      sac_fly: 0,
      steals: 1,
      runs: 2,
      rbi: 3,
      strike_escapes: 0,
      opponent_errors: 0,
      interferences: 0,
      fielder_choices: 0,
      advancing_hits: 0,
      picked_off: 0,
      caught_stealing: 0,
    });
    const expected =
      1 * PARAMS.single! + // single
      1 * PARAMS.double! + // double
      1 * PARAMS.homerun! + // homerun
      1 * PARAMS.walk! +
      1 * PARAMS.steal! +
      2 * PARAMS.run! +
      3 * PARAMS.rbi! +
      4 * PARAMS.plate_appearance!;
    expect(calcBatterPoint(b, fielding(), PARAMS)).toBe(expected);
  });

  it("adds fielding point terms (beauty/rare_play/putout/assist/error) on top of batting", () => {
    const f = fielding({ beauty: 1, rarePlay: 1, putout: 5, assist: 2, error: 1 });
    // season=0 weights all fielding terms at 0 -> no change regardless of counts
    expect(calcBatterPoint(batting(), f, PARAMS)).toBe(0);

    const weighted: SeasonParameters = { ...PARAMS, beauty: 10, error: -5 };
    expect(calcBatterPoint(batting(), f, weighted)).toBe(1 * 10 + 1 * -5);
  });

  it("treats null season_parameters weights as 0 rather than throwing", () => {
    const paramsWithNulls: SeasonParameters = { ...PARAMS, homerun: null, walk: null };
    const b = batting({ homeruns: 2, walks: 3 });
    expect(calcBatterPoint(b, fielding(), paramsWithNulls)).toBe(0);
  });
});

describe("calcPitcherPoint", () => {
  it("returns 0 for an all-zero stat line", () => {
    expect(calcPitcherPoint(pitching(), PARAMS)).toBe(0);
  });

  it("applies negative weights for walks/HBP/earned runs allowed", () => {
    const p = pitching({ wins: 1, outs: 18, strikeouts: 5, walks: 2, hbp: 1, er: 2 });
    const expected =
      1 * PARAMS.win! +
      18 * PARAMS.out! +
      5 * PARAMS.strikeout! +
      2 * PARAMS.walk_allowed! +
      1 * PARAMS.hbp_allowed! +
      2 * PARAMS.earned_run_allowed!;
    expect(expected).toBeLessThan(1 * PARAMS.win! + 18 * PARAMS.out! + 5 * PARAMS.strikeout!);
    expect(calcPitcherPoint(p, PARAMS)).toBe(expected);
  });
});
