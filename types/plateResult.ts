/**
 * 実データでは inning/result 以外はほぼ「該当する場合のみキーが存在する」
 * 疎な形式で保存されている（例: {"rbi":1,"run":true,"inning":1,"result":"中二"}）。
 * そのため result/inning 以外は全てオプショナルとし、集計側は必ず
 * `?? 0` / `?? false` / `?? []` 等でフォールバックすること。
 */
export type PlateResult = {
  inning: number;               // イニング番号
  inning_half?: "表" | "裏";    // 表／裏

  result: string;               // 打席結果（例：左安、四球、遊ゴなど）
  run?: boolean;                 // 得点（●）
  steal?: number;                // 盗塁数（0,1,2）
  out?: boolean;                 // アウト（o）
  rbi?: number;                  // 打点

  pitcher_hand?: "右" | "左" | "不明";  // 投手左右
  direction?: string;            // 打球方向（遊・中・左・右・一・二・三・投など）
  contact_type?: "ゴロ" | "フライ" | "ライナー" | "不明"; // 打球種類

  risp?: boolean;                // 得点圏（2塁または3塁）にランナーあり
  advancing_hit?: boolean;       // 進塁打
  winning_rbi?: boolean;         // 勝利打点

  caught_stealing?: boolean;     // 盗塁死
  picked_off?: boolean;          // 牽制死
  fielding_error?: boolean;      // 守備側の失策
  double_play?: boolean;         // 併殺打
  sacrifice?: boolean;           // 犠打・犠飛
  bunt?: boolean;                // バント試行
  pinch_hitter?: boolean;        // 代打
  pinch_runner?: boolean;        // 代走

  pitch_count?: number;          // 投球数
  pitch_result?: string;         // 最後の球種（ストレート、スライダーなど）

  score_before?: number;         // 打席前の得点
  score_after?: number;          // 打席後の得点
};
