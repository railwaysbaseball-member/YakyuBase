import { readFileSync } from "fs";
import { parseGamePage } from "./parseGamePage.mts";

const html = readFileSync(
  "C:\\Users\\ishid\\AppData\\Local\\Temp\\claude\\c--Users-ishid-yakyubase\\f9d5ec40-33f8-4d6e-a721-8d6763dd2b92\\scratchpad\\game-136.html",
  "utf8"
);

const result = parseGamePage(html, "game-136");

if ("error" in result) {
  console.error("PARSE ERROR:", result.error);
  console.error("warnings:", result.warnings);
  process.exit(1);
}

console.log("date:", result.date, "opponent:", result.opponent);
console.log("time:", result.startTime, "-", result.endTime);
console.log("league:", result.league, "stadium:", result.stadium);
console.log("scoreboard:", JSON.stringify(result.scoreboard));
console.log("warnings:", result.warnings);
console.log("batters:", result.batters.length, "pitchers:", result.pitchers.length, "support:", result.support.length);

const expectedTeam = { innings: { team: [6, 1, 0, 1, 7], opponent: [3, 1, 0, 0, 1] }, total: { team: 15, opponent: 5 } };
console.log("scoreboard OK:", JSON.stringify(result.scoreboard) === JSON.stringify(expectedTeam));

for (const b of result.batters) {
  const r = b.results;
  const sumRuns = r.filter((x) => x.run).length;
  const sumRbi = r.reduce((s, x) => s + (x.rbi ?? 0), 0);
  const sumSteal = r.reduce((s, x) => s + (x.steal ?? 0), 0);
  const ok =
    r.length === b.expected.pa &&
    sumRuns === b.expected.runs &&
    sumRbi === b.expected.rbi &&
    sumSteal === b.expected.steals;
  console.log(
    `${ok ? "OK  " : "FAIL"} order${b.order} ${b.playerName} pos=${b.position} pa=${r.length}/${b.expected.pa} runs=${sumRuns}/${b.expected.runs} rbi=${sumRbi}/${b.expected.rbi} steal=${sumSteal}/${b.expected.steals}`,
    JSON.stringify(r)
  );
}

console.log("--- pitchers ---");
for (const p of result.pitchers) {
  console.log(JSON.stringify(p));
}

console.log("--- support ---");
for (const s of result.support) {
  console.log(JSON.stringify(s));
}
