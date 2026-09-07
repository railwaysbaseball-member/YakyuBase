import { readFileSync } from "fs";
import { parseGamePage } from "./parseGamePage.mts";
import { calcBatting } from "../lib/batting/calcBattingStats";

const SC =
  "C:\\Users\\ishid\\AppData\\Local\\Temp\\claude\\c--Users-ishid-yakyubase\\f9d5ec40-33f8-4d6e-a721-8d6763dd2b92\\scratchpad\\";

const gameIds = ["125", "126", "127", "128", "129", "130", "132", "133", "134", "135", "136", "137", "138"].map(
  (n) => `game-${n}`
);

let totalWarnings = 0;
let totalMismatches = 0;
const playerNames = new Set<string>();

for (const gameId of gameIds) {
  const html = readFileSync(`${SC}${gameId}.html`, "utf8");
  const result = parseGamePage(html, gameId);

  if ("error" in result) {
    console.log(`\n=== ${gameId}: PARSE ERROR: ${result.error} ===`);
    totalMismatches++;
    continue;
  }

  console.log(`\n=== ${gameId}: ${result.date} vs ${result.opponent} (${result.scoreboard.total.team}-${result.scoreboard.total.opponent}) ===`);
  if (result.warnings.length > 0) {
    console.log("  warnings:", result.warnings);
    totalWarnings += result.warnings.length;
  }

  for (const b of result.batters) {
    playerNames.add(b.playerName);
    const calc = calcBatting(b.results);
    const e = b.expected;
    const ok = calc.pa === e.pa && calc.ab === e.ab && calc.hits === e.hits && calc.runs === e.runs && calc.rbi === e.rbi && calc.steals === e.steals;
    if (!ok) {
      totalMismatches++;
      console.log(
        `  MISMATCH order${b.order} ${b.playerName}: got={pa:${calc.pa},ab:${calc.ab},hits:${calc.hits},runs:${calc.runs},rbi:${calc.rbi},steals:${calc.steals}} expected=${JSON.stringify(e)}`
      );
      console.log("    raw results:", JSON.stringify(b.results));
    }
  }

  for (const p of result.pitchers) playerNames.add(p.playerName);
  for (const s of result.support) playerNames.add(s.playerName);
}

console.log("\n\n=== SUMMARY ===");
console.log("games parsed:", gameIds.length);
console.log("total warnings:", totalWarnings);
console.log("total mismatches:", totalMismatches);
console.log("distinct player names encountered:", [...playerNames].sort().join(", "));
