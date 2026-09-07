import { readFileSync, writeFileSync } from "fs";
import { parseGamePage } from "./parseGamePage.mts";
import { calcBatting } from "../lib/batting/calcBattingStats";

const SC =
  "C:\\Users\\ishid\\AppData\\Local\\Temp\\claude\\c--Users-ishid-yakyubase\\f9d5ec40-33f8-4d6e-a721-8d6763dd2b92\\scratchpad\\";

// game-136 は既に投入済みなので対象外
const gameIds = ["125", "126", "127", "128", "129", "130", "132", "133", "134", "135", "137", "138"].map(
  (n) => `game-${n}`
);

const KNOWN_PLAYERS = new Set([
  "joe", "アニキ", "エース", "ちだ", "にしぐち", "のっち", "ひろぽん", "ブンブン丸",
  "まもこ", "ようちゃん", "ラッキーボーイ", "下田", "石ちゃん",
]);

// サイト上の表記ゆれ・重複選手の解消
const NAME_ALIASES: Record<string, string> = {
  "下田 B": "下田",
};

function resolveName(name: string): string {
  return NAME_ALIASES[name] ?? name;
}

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlStrOrNull(s: string | null): string {
  return s === null ? "null" : sqlStr(s);
}

const newPlayers = new Set<string>();
const lines: string[] = [];
lines.push("-- 2026年度シーズン (game-136を除く残り12試合) の実データ投入");
lines.push("-- https://bb.miguee.net/railways1995/ より scripts/parseGamePage.mts + build-season2026-sql.mts で生成");
lines.push("");

let hadFatalError = false;

const gameInsertLines: string[] = [];
const battingInsertLines: string[] = [];
const pitchingInsertLines: string[] = [];
const supportInsertLines: string[] = [];

for (const gameId of gameIds) {
  const html = readFileSync(`${SC}${gameId}.html`, "utf8");
  const result = parseGamePage(html, gameId);

  if ("error" in result) {
    console.error(`${gameId}: PARSE ERROR: ${result.error}`);
    hadFatalError = true;
    continue;
  }
  if (result.warnings.length > 0) {
    console.error(`${gameId}: WARNINGS:`, result.warnings);
    hadFatalError = true;
    continue;
  }

  // 打者成績を自己検証(calcBattingの結果とページ表示の合計が一致するか)
  let gameOk = true;
  for (const b of result.batters) {
    const calc = calcBatting(b.results);
    const e = b.expected;
    if (calc.pa !== e.pa || calc.ab !== e.ab || calc.hits !== e.hits || calc.runs !== e.runs || calc.rbi !== e.rbi || calc.steals !== e.steals) {
      console.error(`${gameId}: MISMATCH order${b.order} ${b.playerName}`, { got: calc, expected: e });
      gameOk = false;
    }
  }
  if (!gameOk) {
    hadFatalError = true;
    continue;
  }

  for (const b of result.batters) {
    const name = resolveName(b.playerName);
    if (!KNOWN_PLAYERS.has(name)) newPlayers.add(name);
  }
  for (const p of result.pitchers) {
    const name = resolveName(p.playerName);
    if (!KNOWN_PLAYERS.has(name)) newPlayers.add(name);
  }
  for (const s of result.support) {
    const name = resolveName(s.playerName);
    if (!KNOWN_PLAYERS.has(name)) newPlayers.add(name);
  }

  gameInsertLines.push(
    `  (${sqlStr(gameId)}, ${sqlStr(result.date)}, ${sqlStrOrNull(result.startTime)}, ${sqlStrOrNull(result.endTime)}, ${sqlStrOrNull(result.league)}, ${sqlStrOrNull(result.stadium)}, ${sqlStr(result.opponent)}, '${JSON.stringify({ innings: result.scoreboard.innings, total: result.scoreboard.total })}'::jsonb)`
  );

  for (const b of result.batters) {
    const calc = calcBatting(b.results);
    const name = resolveName(b.playerName);
    battingInsertLines.push(
      `  (${sqlStr(gameId)}, ${sqlStr(name)}, ${b.order}, ${sqlStr(b.position)}, '${JSON.stringify(b.results)}'::jsonb, ${calc.pa}, ${calc.ab}, ${calc.hits}, ${calc.runs}, ${calc.rbi}, ${calc.steals})`
    );
  }

  for (const p of result.pitchers) {
    const name = resolveName(p.playerName);
    pitchingInsertLines.push(
      `  (${sqlStr(gameId)}, ${sqlStr(name)}, ${p.innings}, ${p.er}, ${p.runs}, ${p.battersFaced}, ${p.strikeouts}, ${p.walks}, ${p.hbp}, ${p.hitsAllowed}, ${p.hrAllowed}, ${p.pitches}, ${p.wp}, ${p.balk}, ${p.decision ? sqlStr(p.decision) : "null"}, ${p.isStarter})`
    );
  }

  // サポートは同一選手が複数役割を持つ場合は1行にマージする
  const supportByPlayer = new Map<string, Set<string>>();
  for (const s of result.support) {
    const name = resolveName(s.playerName);
    const set = supportByPlayer.get(name) ?? new Set<string>();
    set.add(s.role);
    supportByPlayer.set(name, set);
  }
  for (const [name, roles] of supportByPlayer) {
    const cols = ["participate", "manage", "bench", "score", "umpire", "camera", "watch", "cheer"];
    const vals = cols.map((c) => (roles.has(c) ? 1 : 0));
    supportInsertLines.push(`  (${sqlStr(gameId)}, ${sqlStr(name)}, ${vals.join(", ")})`);
  }
}

if (hadFatalError) {
  console.error("\n致命的な問題があったため SQL は生成しませんでした。上記のエラー/ミスマッチ/警告を確認してください。");
  process.exit(1);
}

if (newPlayers.size > 0) {
  lines.push("insert into public.players (id, name) values");
  lines.push(
    [...newPlayers]
      .sort()
      .map((n) => `  (${sqlStr(n)}, ${sqlStr(n)})`)
      .join(",\n") + "\non conflict (id) do nothing;"
  );
  lines.push("");
}

lines.push("insert into public.games (id, date, start_time, end_time, league, stadium, opponent, scoreboard) values");
lines.push(gameInsertLines.join(",\n") + ";");
lines.push("");

lines.push(
  "insert into public.game_batting_stats (game_id, player_id, order_no, position, plate_results, plate_appearances, at_bats, hits, runs, rbi, steals) values"
);
lines.push(battingInsertLines.join(",\n") + ";");
lines.push("");

lines.push(
  "insert into public.game_pitching_stats (game_id, player_id, innings, er, runs, batters_faced, strikeouts, walks, hbp, hits_allowed, hr_allowed, pitches, wp, balk, decision, is_starter) values"
);
lines.push(pitchingInsertLines.join(",\n") + ";");
lines.push("");

if (supportInsertLines.length > 0) {
  lines.push("insert into public.support_stats (game_id, player_id, participate, manage, bench, score, umpire, camera, watch, cheer) values");
  lines.push(supportInsertLines.join(",\n") + ";");
  lines.push("");
}

const outPath = "supabase/seed/season-2026.sql";
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath}`);
console.log("new players to be created:", [...newPlayers].sort());
console.log("games:", gameInsertLines.length, "batting rows:", battingInsertLines.length, "pitching rows:", pitchingInsertLines.length, "support rows:", supportInsertLines.length);
