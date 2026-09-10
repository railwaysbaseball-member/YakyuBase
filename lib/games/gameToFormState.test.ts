import { describe, expect, it } from "vitest";

import { gameToFormState } from "./gameToFormState";
import { buildGameRow, buildPitchingRows, buildPlateResult, resolvePlayerId } from "./buildGameRows";
import { calcBatting } from "@/lib/batting/calcBattingStats";
import type { PlateResult } from "@/types/plateResult";

// game-138 のような実データ相当の固定フィクスチャ（スパースなフラグを含む）。
// gameToFormState() でフォーム初期値に変換し、buildGameRow/buildPitchingRows/
// calcBatting で作り直した結果が元のDB行と完全に一致することを確認する
// （このセッション中に実データgame-138で手動検証した内容を固定テスト化したもの）。
const game = {
  date: "2026-08-23",
  start_time: "13:00:00",
  end_time: "15:30:00",
  league: "練習試合",
  stadium: "淀川河川敷鳥飼上地区3",
  opponent: "ナショナルズ",
  scoreboard: {
    innings: {
      team: [4, 0, 0, 3, 0] as (number | null)[],
      opponent: [0, 0, 4, 5, 2] as (number | null)[],
    },
  },
};

const battingRows = [
  {
    player_id: "石ちゃん",
    order_no: 2,
    position: "中堅",
    plate_results: [
      { inning: 1, result: "投内", run: true },
      { inning: 3, result: "右安", steal: 1 },
      { inning: 5, result: "三ゴ" },
    ] as PlateResult[],
  },
  {
    player_id: "のっち",
    order_no: 5,
    position: "遊撃",
    plate_results: [
      { inning: 1, result: "左本", rbi: 4, run: true },
      { inning: 3, result: "三ゴ" },
    ] as PlateResult[],
  },
  {
    player_id: "アニキ",
    order_no: 4,
    position: "一塁",
    plate_results: [
      { inning: 1, result: "四球", run: true },
      { inning: 3, result: "三振" },
      { inning: 5, result: "遊併", double_play: true },
    ] as PlateResult[],
  },
];

const pitchingRows = [
  {
    player_id: "joe",
    innings: 3,
    er: 0,
    runs: 4,
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
    is_starter: true,
  },
  {
    player_id: "エース",
    innings: 4.1,
    er: 5,
    runs: 7,
    batters_faced: 20,
    strikeouts: 3,
    walks: 2,
    hbp: 0,
    hits_allowed: 6,
    hr_allowed: 1,
    pitches: 60,
    wp: 1,
    balk: 0,
    decision: "L",
    is_starter: false,
  },
];

describe("gameToFormState", () => {
  it("converts null scoreboard cells to empty strings and numbers to their string form", () => {
    const initial = gameToFormState(game, battingRows, pitchingRows);
    expect(initial.inningsTeam).toEqual(["4", "0", "0", "3", "0"]);
    expect(initial.inningsOpponent).toEqual(["0", "0", "4", "5", "2"]);
  });

  it("orders batters by order_no regardless of input order", () => {
    const initial = gameToFormState(game, battingRows, pitchingRows);
    expect(initial.batters.map((b) => b.player.playerId)).toEqual(["石ちゃん", "アニキ", "のっち"]);
  });

  it("splits pitching innings back into inningsWhole/inningsOuts", () => {
    const initial = gameToFormState(game, battingRows, pitchingRows);
    const ace = initial.pitchers.find((p) => p.player.playerId === "エース")!;
    expect(ace.inningsWhole).toBe("4");
    expect(ace.inningsOuts).toBe("1");
  });

  it("round-trips through buildGameRow/buildPitchingRows/calcBatting to reproduce the original data exactly", () => {
    const initial = gameToFormState(game, battingRows, pitchingRows);

    const rebuiltGame = buildGameRow("game-138", initial);
    expect(rebuiltGame.scoreboard.innings).toEqual(game.scoreboard.innings);
    expect(rebuiltGame.scoreboard.total).toEqual({ team: 7, opponent: 11 });

    for (const draft of initial.batters) {
      const original = battingRows.find((b) => b.player_id === resolvePlayerId(draft.player))!;
      const rebuiltPR = draft.plateResults.map(buildPlateResult).filter((v): v is PlateResult => v !== null);
      expect(rebuiltPR).toEqual(original.plate_results);

      const calc = calcBatting(rebuiltPR);
      const calcOriginal = calcBatting(original.plate_results ?? []);
      expect(calc.pa).toBe(calcOriginal.pa);
      expect(calc.ab).toBe(calcOriginal.ab);
      expect(calc.hits).toBe(calcOriginal.hits);
      expect(calc.runs).toBe(calcOriginal.runs);
      expect(calc.rbi).toBe(calcOriginal.rbi);
      expect(calc.steals).toBe(calcOriginal.steals);
    }

    const rebuiltPitching = buildPitchingRows("game-138", initial);
    for (const rebuilt of rebuiltPitching) {
      const original = pitchingRows.find((p) => p.player_id === rebuilt.player_id)!;
      expect(rebuilt.innings).toBe(original.innings);
      expect(rebuilt.er).toBe(original.er);
      expect(rebuilt.runs).toBe(original.runs);
      expect(rebuilt.decision).toBe(original.decision);
      expect(rebuilt.is_starter).toBe(original.is_starter);
    }
  });
});
