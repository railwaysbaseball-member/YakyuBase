import type { SeasonParameters } from "@/types/seasonParameters";

export type SeasonParameterField = keyof Omit<SeasonParameters, "id" | "season" | "created_at">;

export const SEASON_PARAMETER_GROUPS: {
  title: string;
  fields: { key: SeasonParameterField; label: string }[];
}[] = [
  {
    title: "規定・QS設定",
    fields: [
      { key: "inning_count", label: "1試合の規定イニング数" },
      { key: "required_pa", label: "規定打席倍率（試合数×この値を切り上げ）" },
      { key: "required_ip", label: "規定投球回倍率（試合数×この値を切り上げ）" },
      { key: "qs", label: "QS認定に必要な最低投球回" },
      { key: "earned_runs", label: "QS認定の自責点上限" },
    ],
  },
  {
    title: "打者・守備POINT",
    fields: [
      { key: "strike_escape", label: "振り逃げ" },
      { key: "opponent_error", label: "敵失" },
      { key: "interference", label: "打撃妨害" },
      { key: "fielder_choice", label: "野選" },
      { key: "walk", label: "四球" },
      { key: "hbp", label: "死球" },
      { key: "sac_bunt", label: "犠打" },
      { key: "sac_fly", label: "犠飛" },
      { key: "infield_hit", label: "内野安打" },
      { key: "single", label: "単打" },
      { key: "double", label: "二塁打" },
      { key: "triple", label: "三塁打" },
      { key: "homerun", label: "本塁打" },
      { key: "steal", label: "盗塁" },
      { key: "run", label: "得点" },
      { key: "rbi", label: "打点" },
      { key: "plate_appearance", label: "打席" },
      { key: "advancing_hit", label: "進塁打" },
      { key: "picked_off", label: "牽制死" },
      { key: "caught_stealing", label: "盗塁死" },
      { key: "beauty", label: "美技" },
      { key: "rare_play", label: "珍技" },
      { key: "putout", label: "刺殺" },
      { key: "assist", label: "補殺" },
      { key: "error", label: "失策" },
    ],
  },
  {
    title: "投手POINT",
    fields: [
      { key: "win", label: "勝利" },
      { key: "out", label: "OUT" },
      { key: "strikeout", label: "奪三振" },
      { key: "walk_allowed", label: "与四球" },
      { key: "hbp_allowed", label: "与死球" },
      { key: "earned_run_allowed", label: "自責点" },
    ],
  },
];

export function toNumOrNull(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
