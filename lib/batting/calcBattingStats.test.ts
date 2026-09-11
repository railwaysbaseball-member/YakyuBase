import { describe, expect, it } from "vitest";

import { calcBatting } from "./calcBattingStats";
import type { PlateResult } from "@/types/plateResult";

function pr(inning: number, result: string, extra: Partial<PlateResult> = {}): PlateResult {
  return { inning, result, ...extra };
}

describe("calcBatting", () => {
  it("returns all-zero stats for an empty plate-result list", () => {
    const calc = calcBatting([]);
    expect(calc.pa).toBe(0);
    expect(calc.ab).toBe(0);
    expect(calc.hits).toBe(0);
    expect(calc.avg).toBe(0);
    expect(calc.obp).toBe(0);
    expect(calc.slg).toBe(0);
    expect(calc.rc27).toBe(0);
  });

  it("classifies hits by the last character, not substring inclusion", () => {
    // 遊内: last char 内 -> infield single. 中三: last char 三 -> triple.
    // 左本: last char 本 -> homerun. These would be misclassified by
    // res.includes("安") style checks, which is exactly the historical bug.
    const calc = calcBatting([
      pr(1, "遊内"),
      pr(2, "中三"),
      pr(3, "左本"),
      pr(4, "中安"),
      pr(5, "右二"),
    ]);
    expect(calc.hits).toBe(5);
    expect(calc.singles).toBe(2); // 遊内 + 中安
    expect(calc.infield_hits).toBe(1); // 遊内
    expect(calc.doubles).toBe(1); // 右二
    expect(calc.triples).toBe(1); // 中三
    expect(calc.homeruns).toBe(1); // 左本
    expect(calc.ab).toBe(5);
    expect(calc.pa).toBe(5);
  });

  it("excludes walks/HBP/sacrifices/interference from AB but counts them in PA", () => {
    const calc = calcBatting([
      pr(1, "四球"),
      pr(2, "死球"),
      pr(3, "中犠"), // 犠飛 (direction char is 中/左/右 -> sac fly)
      pr(4, "一犠"), // 犠打 (infield direction -> sac bunt)
      pr(5, "打妨"),
    ]);
    expect(calc.pa).toBe(5);
    expect(calc.ab).toBe(0);
    expect(calc.walks).toBe(1);
    expect(calc.hbp).toBe(1);
    expect(calc.sac_fly).toBe(1);
    expect(calc.sac_bunt).toBe(1);
    expect(calc.interferences).toBe(1);
  });

  it("counts strikeouts as an AB and not a hit", () => {
    const calc = calcBatting([pr(1, "三振")]);
    expect(calc.pa).toBe(1);
    expect(calc.ab).toBe(1);
    expect(calc.hits).toBe(0);
    expect(calc.strikeouts).toBe(1);
  });

  it("counts 振逃/野選/敵失 as an AB out (not a hit) but tags them for POINT", () => {
    const calc = calcBatting([pr(1, "振逃"), pr(2, "三野"), pr(3, "遊失")]);
    expect(calc.ab).toBe(3);
    expect(calc.hits).toBe(0);
    expect(calc.strike_escapes).toBe(1);
    expect(calc.fielder_choices).toBe(1);
    expect(calc.opponent_errors).toBe(1);
  });

  it("excludes 代走 (pinch runner) entries from PA/AB entirely", () => {
    const calc = calcBatting([pr(1, "代走", { run: true }), pr(2, "中安")]);
    expect(calc.pa).toBe(1);
    expect(calc.ab).toBe(1);
    expect(calc.runs).toBe(1); // still counted
    expect(calc.hits).toBe(1);
  });

  it("tracks runs, RBI, and steals independent of AB classification", () => {
    const calc = calcBatting([
      pr(1, "中安", { run: true, rbi: 2 }),
      pr(2, "四球", { steal: 1 }),
    ]);
    expect(calc.runs).toBe(1);
    expect(calc.rbi).toBe(2);
    expect(calc.steals).toBe(1);
  });

  it("counts caught_stealing/picked_off/double_play for true-outs accounting", () => {
    const calc = calcBatting([
      pr(1, "中安", { caught_stealing: true }),
      pr(2, "遊併", { double_play: true }),
    ]);
    expect(calc.caught_stealing).toBe(1);
    expect(calc.double_plays).toBe(1);
  });

  it("only counts RISP AB/hits when the result is flagged risp (td class='tktnkn')", () => {
    // 取得元サイトは2塁/3塁の区別までは示さず、打席セルに class='tktnkn'
    // が付くかどうかの単純な真偽値でしか得点圏を判定できない。
    const calc = calcBatting([
      pr(1, "中安"), // risp未設定 -> RISPではない
      pr(2, "右安", { risp: true }), // RISP hit
      pr(3, "三振", { risp: true }), // RISP AB (no hit)
      pr(4, "四球", { risp: true }), // 四球はRISP ABに含まれない(AB自体が0)
    ]);
    expect(calc.risp_ab).toBe(2);
    expect(calc.risp_hits).toBe(1);
    expect(calc.risp_avg).toBeCloseTo(0.5);
  });

  it("computes AVG/OBP/SLG/OPS with the standard formulas", () => {
    const calc = calcBatting([
      pr(1, "中安"), // single
      pr(2, "右二"), // double
      pr(3, "四球"),
      pr(4, "三振"),
    ]);
    // AB = 3 (安, 二, 三振), hits = 2
    expect(calc.ab).toBe(3);
    expect(calc.hits).toBe(2);
    expect(calc.avg).toBeCloseTo(2 / 3);
    // OBP = (H+BB+HBP) / (AB+BB+HBP+SF) = (2+1)/(3+1) = 3/4
    expect(calc.obp).toBeCloseTo(3 / 4);
    // SLG = total bases / AB = (1+2)/3
    expect(calc.slg).toBeCloseTo(3 / 3);
    expect(calc.ops).toBeCloseTo(calc.obp + calc.slg);
  });

  it("computes RC27 using true outs (AB - hits + CS + DP) as the denominator", () => {
    const calc = calcBatting([
      pr(1, "中安"),
      pr(2, "遊ゴ", { double_play: true }),
      pr(3, "三ゴ"),
    ]);
    // AB=3, hits=1, outs = 3 - 1 + 0(cs) + 1(dp) = 3
    const totalBases = 1;
    const rc = ((calc.hits + calc.walks) * totalBases) / (calc.ab + calc.walks || 1);
    const outs = calc.ab - calc.hits + calc.caught_stealing + calc.double_plays;
    expect(outs).toBe(3);
    expect(calc.rc27).toBeCloseTo((rc * 27) / outs);
  });
});
