import type { PitchingStats } from "@/types/pitching";

// このリーグの投球回はプロ野球と同じ「アウト数」表記（.1 = 1アウト, .2 = 2アウト）。
// 例: 1.2 = 1回2/3 = 実質 1 + 2/3 イニング。単純な小数として足し引きすると
// 0.1 + 0.2 = 0.3（誤り。正しくは 1.0）になるため、必ずアウト数に変換して集計する。
function inningsToOuts(innings: number): number {
  const whole = Math.trunc(innings);
  const frac = Math.round((innings - whole) * 10); // 0, 1, 2 のいずれか
  return whole * 3 + frac;
}

function outsToInnings(outs: number): number {
  const whole = Math.trunc(outs / 3);
  const frac = outs % 3;
  return whole + frac / 10;
}

function outsToRealInnings(outs: number): number {
  return outs / 3;
}

/** 総アウト数を "67回2/3" のような表示用文字列に変換する */
export function formatInnings(outs: number): string {
  const whole = Math.trunc(outs / 3);
  const frac = outs % 3;
  return frac === 0 ? `${whole}回` : `${whole}回${frac}/3`;
}

export type CalculatedPitching = {
  games: number; // 試合
  starts: number; // 先発

  outs: number; // 集計用の総アウト数
  innings: number; // 投球回数（プロ野球表記 例: 67.2 = 67回2/3）
  inningsReal: number; // 実イニング数（率計算用 例: 67.667）

  battersFaced: number; // 打者数
  hitsAllowed: number; // 被安打
  hrAllowed: number; // 被本塁打
  strikeouts: number; // 奪三振
  walks: number; // 与四球
  hbp: number; // 与死球
  runs: number; // 失点
  er: number; // 自責点
  pitches: number; // 投球数
  wp: number; // 暴投
  balk: number; // ボーク

  wins: number; // 勝
  losses: number; // 負
  saves: number; // Ｓ
  holds: number; // Ｈ

  qs: number; // クオリティスタート
  qsRate: number; // QS率 [%]

  // 率系（このリーグは1試合7回制のため、9ではなく7を基準に算出する。
  // 実データの合計行から逆算して確認済み: 例 自責点63・投球回67回2/3 → 防御率6.52）
  era: number; // 防御率
  ra: number; // 失点率
  kRate: number; // 奪三振率（7イニングあたり）
  bbHbpRate: number; // 与四死球率（7イニングあたり）
  whip: number; // WHIP（被安打+与四球 / イニング。通常のWHIPと同じく7ではなく1イニング基準）
};

export type CalcPitchingOptions = {
  /**
   * QS認定に必要な最低投球回（実イニング数）。
   * season_parameters の「全年度共通」行の値（イニング数=6）に基づく既定値。
   * 年度によって異なる（2024:5, 2025:3等）ため、呼び出し側でその年度の
   * season_parameters 値を渡して上書きすること。
   */
  qsMinInnings?: number;
  /**
   * QS認定の自責点上限。
   * season_parameters の「全年度共通」行の値（自責点数=3）に基づく既定値。
   * 年度によって異なる（2024:3, 2025:1等）ため、呼び出し側でその年度の
   * season_parameters 値を渡して上書きすること。
   */
  qsMaxEarnedRuns?: number;
};

const DEFAULT_QS_MIN_INNINGS = 6; // season_parameters「全年度共通」のQSイニング数
const DEFAULT_QS_MAX_EARNED_RUNS = 3; // season_parameters「全年度共通」のQS自責点数
const INNINGS_BASIS = 7; // season_parameters「全年度共通」のイニング数（1試合7回制）

export function calcPitching(
  rows: PitchingStats[],
  options: CalcPitchingOptions = {}
): CalculatedPitching {
  const qsMinInnings = options.qsMinInnings ?? DEFAULT_QS_MIN_INNINGS;
  const qsMaxEarnedRuns = options.qsMaxEarnedRuns ?? DEFAULT_QS_MAX_EARNED_RUNS;

  let outs = 0;
  let battersFaced = 0;
  let hitsAllowed = 0;
  let hrAllowed = 0;
  let strikeouts = 0;
  let walks = 0;
  let hbp = 0;
  let runs = 0;
  let er = 0;
  let pitches = 0;
  let wp = 0;
  let balk = 0;

  let wins = 0;
  let losses = 0;
  let saves = 0;
  let holds = 0;

  let starts = 0;
  let qs = 0;

  for (const row of rows) {
    outs += inningsToOuts(row.innings ?? 0);
    battersFaced += row.batters_faced ?? 0;
    hitsAllowed += row.hits_allowed ?? 0;
    hrAllowed += row.hr_allowed ?? 0;
    strikeouts += row.strikeouts ?? 0;
    walks += row.walks ?? 0;
    hbp += row.hbp ?? 0;
    runs += row.runs ?? 0;
    er += row.er ?? 0;
    pitches += row.pitches ?? 0;
    wp += row.wp ?? 0;
    balk += row.balk ?? 0;

    switch (row.decision) {
      case "W":
        wins++;
        break;
      case "L":
        losses++;
        break;
      case "S":
        saves++;
        break;
      case "H":
        holds++;
        break;
    }

    if (row.is_starter) {
      starts++;

      const rowRealInnings = outsToRealInnings(inningsToOuts(row.innings ?? 0));
      if (rowRealInnings >= qsMinInnings && (row.er ?? 0) <= qsMaxEarnedRuns) {
        qs++;
      }
    }
  }

  const inningsReal = outsToRealInnings(outs);
  const innings = outsToInnings(outs);

  const era = inningsReal > 0 ? (er * INNINGS_BASIS) / inningsReal : 0;
  const ra = inningsReal > 0 ? (runs * INNINGS_BASIS) / inningsReal : 0;
  const kRate = inningsReal > 0 ? (strikeouts * INNINGS_BASIS) / inningsReal : 0;
  const bbHbpRate =
    inningsReal > 0 ? ((walks + hbp) * INNINGS_BASIS) / inningsReal : 0;
  const whip = inningsReal > 0 ? (hitsAllowed + walks) / inningsReal : 0;
  const qsRate = starts > 0 ? (qs / starts) * 100 : 0;

  return {
    games: rows.length,
    starts,

    outs,
    innings,
    inningsReal,

    battersFaced,
    hitsAllowed,
    hrAllowed,
    strikeouts,
    walks,
    hbp,
    runs,
    er,
    pitches,
    wp,
    balk,

    wins,
    losses,
    saves,
    holds,

    qs,
    qsRate,

    era,
    ra,
    kRate,
    bbHbpRate,
    whip,
  };
}
