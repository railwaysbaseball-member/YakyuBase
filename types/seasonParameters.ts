export type SeasonParameters = {
  id: string;
  /** 対象年度。0 は「全年度共通」のデフォルト値（該当年度の行が無い場合のフォールバック） */
  season: number;

  /** 1試合の規定イニング数（例: 7） */
  inning_count: number | null;
  /** 規定打席数の倍率（実際の試合数 × この値を切り上げ） */
  required_pa: number | null;
  /** 規定投球回数の倍率（実際の試合数 × この値を切り上げ） */
  required_ip: number | null;
  /** QS認定に必要な最低投球回 */
  qs: number | null;
  /** QS認定の自責点上限 */
  earned_runs: number | null;

  // POINT加点（打者・守備）
  strike_escape: number | null; // 振り逃げ
  opponent_error: number | null; // 敵失
  interference: number | null; // 打撃妨害
  fielder_choice: number | null; // 野選
  walk: number | null; // 四球
  hbp: number | null; // 死球
  sac_bunt: number | null; // 犠打
  sac_fly: number | null; // 犠飛
  infield_hit: number | null; // 内野安打
  single: number | null; // 単打
  double: number | null; // 二塁打
  triple: number | null; // 三塁打
  homerun: number | null; // 本塁打
  steal: number | null; // 盗塁
  run: number | null; // 得点
  rbi: number | null; // 打点
  plate_appearance: number | null; // 打席
  advancing_hit: number | null; // 進塁打
  picked_off: number | null; // 牽制死
  caught_stealing: number | null; // 盗塁死
  beauty: number | null; // 美技
  rare_play: number | null; // 珍技
  putout: number | null; // 刺殺
  assist: number | null; // 補殺
  error: number | null; // 失策

  // POINT加点（投手）
  win: number | null; // 勝利
  out: number | null; // OUT
  strikeout: number | null; // 奪三振
  walk_allowed: number | null; // 与四球
  hbp_allowed: number | null; // 与死球
  earned_run_allowed: number | null; // 自責点

  created_at: string;
};
