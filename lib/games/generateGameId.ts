import { nextIdForDate } from "@/lib/nextIdForDate";

export function nextGameId(date: string, existingIdsForDate: string[]): string {
  return nextIdForDate("game", date, existingIdsForDate);
}
