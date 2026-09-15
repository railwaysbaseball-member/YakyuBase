export type PlayerStatus = "active" | "guest" | "retired";

export function playerStatusOf(p: { is_guest: boolean; is_retired: boolean }): PlayerStatus {
  if (p.is_retired) return "retired";
  if (p.is_guest) return "guest";
  return "active";
}
