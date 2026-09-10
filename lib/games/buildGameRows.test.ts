import { describe, expect, it } from "vitest";

import {
  buildGameRow,
  buildPitchingRows,
  buildPlateResult,
  newPlayerNamesFromPayload,
  resolvePlayerId,
  sumInnings,
  toInningCell,
  toIntOrNull,
  validateGamePayload,
  type BatterDraft,
  type GameFormPayload,
  type PitcherDraft,
  type PlateResultDraft,
  type PlayerRef,
} from "./buildGameRows";

function existingPlayer(id: string): PlayerRef {
  return { mode: "existing", playerId: id, newName: "" };
}
function newPlayer(name: string): PlayerRef {
  return { mode: "new", playerId: "", newName: name };
}

function plateResult(overrides: Partial<PlateResultDraft> = {}): PlateResultDraft {
  return {
    inning: "1",
    result: "中安",
    run: false,
    rbi: "0",
    steal: "0",
    risp2: false,
    risp3: false,
    advancingHit: false,
    caughtStealing: false,
    pickedOff: false,
    doublePlay: false,
    ...overrides,
  };
}

function batter(overrides: Partial<BatterDraft> = {}): BatterDraft {
  return {
    player: existingPlayer("石ちゃん"),
    orderNo: "1",
    position: "中堅",
    plateResults: [plateResult()],
    ...overrides,
  };
}

function pitcher(overrides: Partial<PitcherDraft> = {}): PitcherDraft {
  return {
    player: existingPlayer("エース"),
    isStarter: true,
    inningsWhole: "7",
    inningsOuts: "0",
    er: "0",
    runs: "0",
    battersFaced: "0",
    strikeouts: "0",
    walks: "0",
    hbp: "0",
    hitsAllowed: "0",
    hrAllowed: "0",
    pitches: "0",
    wp: "0",
    balk: "0",
    decision: "",
    ...overrides,
  };
}

function payload(overrides: Partial<GameFormPayload> = {}): GameFormPayload {
  return {
    date: "2026-09-10",
    startTime: "10:00",
    endTime: "12:00",
    league: "練習試合",
    stadium: "淀川河川敷",
    opponent: "テストチーム",
    inningsTeam: ["1", "2", "0"],
    inningsOpponent: ["0", "1", "1"],
    batters: [batter()],
    pitchers: [pitcher()],
    ...overrides,
  };
}

describe("resolvePlayerId", () => {
  it("uses playerId when mode is existing", () => {
    expect(resolvePlayerId(existingPlayer("joe"))).toBe("joe");
  });
  it("uses trimmed newName when mode is new", () => {
    expect(resolvePlayerId(newPlayer("  新人選手  "))).toBe("新人選手");
  });
  it("returns null for a blank selection", () => {
    expect(resolvePlayerId(existingPlayer(""))).toBeNull();
    expect(resolvePlayerId(newPlayer("   "))).toBeNull();
  });
});

describe("toInningCell / sumInnings / toIntOrNull", () => {
  it("treats a blank cell as null, not 0 (distinguishes 'didn't bat' from 'scored 0')", () => {
    expect(toInningCell("")).toBeNull();
    expect(toInningCell("  ")).toBeNull();
    expect(toInningCell("0")).toBe(0);
    expect(toInningCell("3")).toBe(3);
  });
  it("sums innings treating null cells as 0", () => {
    expect(sumInnings([1, null, 2, null])).toBe(3);
    expect(sumInnings([])).toBe(0);
  });
  it("toIntOrNull mirrors toInningCell for numeric text fields", () => {
    expect(toIntOrNull("")).toBeNull();
    expect(toIntOrNull("5")).toBe(5);
    expect(toIntOrNull("abc")).toBeNull();
  });
});

describe("buildPlateResult", () => {
  it("returns null when inning is missing/non-positive or result is blank", () => {
    expect(buildPlateResult(plateResult({ inning: "" }))).toBeNull();
    expect(buildPlateResult(plateResult({ inning: "0" }))).toBeNull();
    expect(buildPlateResult(plateResult({ inning: "-1" }))).toBeNull();
    expect(buildPlateResult(plateResult({ result: "" }))).toBeNull();
    expect(buildPlateResult(plateResult({ result: "   " }))).toBeNull();
  });

  it("omits falsy/zero optional fields entirely rather than writing them as 0/false", () => {
    const pr = buildPlateResult(plateResult());
    expect(pr).toEqual({ inning: 1, result: "中安" });
    expect(pr).not.toHaveProperty("run");
    expect(pr).not.toHaveProperty("rbi");
    expect(pr).not.toHaveProperty("steal");
    expect(pr).not.toHaveProperty("runners_on");
  });

  it("includes only the flags that are actually set", () => {
    const pr = buildPlateResult(
      plateResult({ run: true, rbi: "2", steal: "1", risp2: true, doublePlay: true })
    );
    expect(pr).toEqual({
      inning: 1,
      result: "中安",
      run: true,
      rbi: 2,
      steal: 1,
      runners_on: [2],
      double_play: true,
    });
  });

  it("includes both runners_on entries when risp2 and risp3 are both set", () => {
    const pr = buildPlateResult(plateResult({ risp2: true, risp3: true }));
    expect(pr?.runners_on).toEqual([2, 3]);
  });
});

describe("validateGamePayload", () => {
  it("accepts a minimal valid payload", () => {
    expect(validateGamePayload(payload())).toBeNull();
  });

  it("rejects a malformed date", () => {
    expect(validateGamePayload(payload({ date: "2026/09/10" }))).toMatch(/日付/);
    expect(validateGamePayload(payload({ date: "" }))).toMatch(/日付/);
  });

  it("rejects a blank opponent", () => {
    expect(validateGamePayload(payload({ opponent: "  " }))).toMatch(/対戦相手/);
  });

  it("rejects zero batters or zero pitchers", () => {
    expect(validateGamePayload(payload({ batters: [] }))).toMatch(/打者/);
    expect(validateGamePayload(payload({ pitchers: [] }))).toMatch(/投手/);
  });

  it("rejects a batter with an unresolved player", () => {
    expect(
      validateGamePayload(payload({ batters: [batter({ player: existingPlayer("") })] }))
    ).toMatch(/打者の選手/);
  });

  it("rejects a batter with zero plate appearances", () => {
    expect(
      validateGamePayload(payload({ batters: [batter({ plateResults: [] })] }))
    ).toMatch(/打席が1件もありません/);
  });

  it("rejects a batter whose plate result is missing inning/result", () => {
    expect(
      validateGamePayload(
        payload({ batters: [batter({ plateResults: [plateResult({ result: "" })] })] })
      )
    ).toMatch(/打席入力に不備/);
  });

  it("rejects duplicate players among batters", () => {
    expect(
      validateGamePayload(
        payload({
          batters: [batter({ player: existingPlayer("石ちゃん") }), batter({ player: existingPlayer("石ちゃん") })],
        })
      )
    ).toMatch(/複数回登録/);
  });

  it("rejects duplicate players among pitchers", () => {
    expect(
      validateGamePayload(
        payload({
          pitchers: [pitcher({ player: existingPlayer("エース") }), pitcher({ player: existingPlayer("エース"), isStarter: false })],
        })
      )
    ).toMatch(/複数回登録/);
  });

  it("rejects zero starters", () => {
    expect(
      validateGamePayload(payload({ pitchers: [pitcher({ isStarter: false })] }))
    ).toMatch(/先発投手をちょうど1人/);
  });

  it("rejects more than one starter", () => {
    expect(
      validateGamePayload(
        payload({
          pitchers: [
            pitcher({ player: existingPlayer("エース"), isStarter: true }),
            pitcher({ player: existingPlayer("2番手"), isStarter: true }),
          ],
        })
      )
    ).toMatch(/先発投手をちょうど1人/);
  });
});

describe("newPlayerNamesFromPayload", () => {
  it("collects trimmed names only from mode:new batters/pitchers, deduped", () => {
    const p = payload({
      batters: [batter({ player: newPlayer("新人A") }), batter({ player: newPlayer(" 新人A ") })],
      pitchers: [pitcher({ player: newPlayer("新人B") })],
    });
    expect(newPlayerNamesFromPayload(p)).toEqual(new Set(["新人A", "新人B"]));
  });

  it("returns an empty set when everyone is an existing player", () => {
    expect(newPlayerNamesFromPayload(payload())).toEqual(new Set());
  });
});

describe("buildGameRow", () => {
  it("computes scoreboard totals from the per-inning cells, treating blanks as not-batted", () => {
    const row = buildGameRow("game-20260910", payload({ inningsTeam: ["1", "", "2"], inningsOpponent: ["0", "0", ""] }));
    expect(row.scoreboard).toEqual({
      innings: { team: [1, null, 2], opponent: [0, 0, null] },
      total: { team: 3, opponent: 0 },
    });
  });

  it("nulls out optional text fields left blank, and trims the opponent name", () => {
    const row = buildGameRow(
      "game-20260910",
      payload({ startTime: "", endTime: "", league: "", stadium: "", opponent: "  相手チーム  " })
    );
    expect(row.start_time).toBeNull();
    expect(row.end_time).toBeNull();
    expect(row.league).toBeNull();
    expect(row.stadium).toBeNull();
    expect(row.opponent).toBe("相手チーム");
  });

  it("uses the provided gameId as-is", () => {
    expect(buildGameRow("game-abc", payload()).id).toBe("game-abc");
  });
});

describe("buildPitchingRows", () => {
  it("reconstructs the box-score innings number from inningsWhole/inningsOuts", () => {
    const rows = buildPitchingRows(
      "game-20260910",
      payload({ pitchers: [pitcher({ inningsWhole: "4", inningsOuts: "2" })] })
    );
    expect(rows[0].innings).toBeCloseTo(4.2);
  });

  it("nulls out a blank decision", () => {
    const rows = buildPitchingRows("g", payload({ pitchers: [pitcher({ decision: "" })] }));
    expect(rows[0].decision).toBeNull();
  });

  it("preserves a set decision and is_starter flag", () => {
    const rows = buildPitchingRows(
      "g",
      payload({ pitchers: [pitcher({ decision: "W", isStarter: true })] })
    );
    expect(rows[0].decision).toBe("W");
    expect(rows[0].is_starter).toBe(true);
  });
});
