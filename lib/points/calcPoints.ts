import type { CalculatedBatting } from "@/lib/batting/calcBattingStats";
import type { CalculatedFielding } from "@/lib/fielding/calcFieldingStats";
import type { CalculatedPitching } from "@/lib/pitching/calcPitchingStats";
import type { SeasonParameters } from "@/types/seasonParameters";

/**
 * 打者・守備POINT。season_parameters の重み付けに従い、打撃成績と守備成績を
 * 合算した1つのポイントにする（サイトの「打者・守備ポイント」列に相当）。
 */
export function calcBatterPoint(
  batting: CalculatedBatting,
  fielding: CalculatedFielding,
  params: SeasonParameters
): number {
  const p = (v: number | null) => v ?? 0;

  const battingPoint =
    batting.strike_escapes * p(params.strike_escape) +
    batting.opponent_errors * p(params.opponent_error) +
    batting.interferences * p(params.interference) +
    batting.fielder_choices * p(params.fielder_choice) +
    batting.walks * p(params.walk) +
    batting.hbp * p(params.hbp) +
    batting.sac_bunt * p(params.sac_bunt) +
    batting.sac_fly * p(params.sac_fly) +
    batting.infield_hits * p(params.infield_hit) +
    (batting.singles - batting.infield_hits) * p(params.single) +
    batting.doubles * p(params.double) +
    batting.triples * p(params.triple) +
    batting.homeruns * p(params.homerun) +
    batting.steals * p(params.steal) +
    batting.runs * p(params.run) +
    batting.rbi * p(params.rbi) +
    batting.pa * p(params.plate_appearance) +
    batting.advancing_hits * p(params.advancing_hit) +
    batting.picked_off * p(params.picked_off) +
    batting.caught_stealing * p(params.caught_stealing);

  const fieldingPoint =
    fielding.beauty * p(params.beauty) +
    fielding.rarePlay * p(params.rare_play) +
    fielding.putout * p(params.putout) +
    fielding.assist * p(params.assist) +
    fielding.error * p(params.error);

  return battingPoint + fieldingPoint;
}

/** 投手POINT。season_parameters の重み付けに従う（サイトの「投手ポイント」列に相当）。 */
export function calcPitcherPoint(
  pitching: CalculatedPitching,
  params: SeasonParameters
): number {
  const p = (v: number | null) => v ?? 0;

  return (
    pitching.wins * p(params.win) +
    pitching.outs * p(params.out) +
    pitching.strikeouts * p(params.strikeout) +
    pitching.walks * p(params.walk_allowed) +
    pitching.hbp * p(params.hbp_allowed) +
    pitching.er * p(params.earned_run_allowed)
  );
}
