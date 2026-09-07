// 汎用版: 指定した試合ID群を Railsways サイトからパースしてSQLを生成する。
// 使い方: npx tsx scripts/build-games-sql.mts <出力ファイル> <gameId1> <gameId2> ...
// (事前に対象のHTMLを SCRATCHPAD_DIR に <gameId>.html として保存しておくこと)

import { readFileSync, writeFileSync, existsSync } from "fs";
import { parseGamePage } from "./parseGamePage.mts";
import { calcBatting } from "../lib/batting/calcBattingStats";

const SCRATCHPAD_DIR =
  "C:\\Users\\ishid\\AppData\\Local\\Temp\\claude\\c--Users-ishid-yakyubase\\f9d5ec40-33f8-4d6e-a721-8d6763dd2b92\\scratchpad\\";

// サイト上の表記ゆれ・同姓別人の解消（member-IDで確認済みのもののみ登録）
// 例: game-134の「下田」とgame-136の「下田 B」はどちらも member-26 の同一人物。
const NAME_ALIASES: Record<string, string> = {
  "下田 B": "下田",
};

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlStrOrNull(s: string | null): string {
  return s === null ? "null" : sqlStr(s);
}

async function loadEnv() {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

async function fetchExisting(table: string, column: string): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = await res.json();
  return new Set(rows.map((r: Record<string, string>) => r[column]));
}

function resolveName(name: string): string {
  return NAME_ALIASES[name] ?? name;
}

async function main() {
  const [outPath, ...gameIds] = process.argv.slice(2);
  if (!outPath || gameIds.length === 0) {
    console.error("使い方: npx tsx scripts/build-games-sql.mts <出力ファイル> <gameId1> <gameId2> ...");
    process.exit(1);
  }

  await loadEnv();
  const existingPlayers = await fetchExisting("players", "id");
  const existingGames = await fetchExisting("games", "id");

  const newPlayers = new Set<string>();
  const gameInsertLines: string[] = [];
  const battingInsertLines: string[] = [];
  const pitchingInsertLines: string[] = [];
  const supportInsertLines: string[] = [];

  let skipped = 0;
  const skippedForReview: string[] = [];

  for (const gameId of gameIds) {
    if (existingGames.has(gameId)) {
      skipped++;
      continue;
    }

    const filePath = `${SCRATCHPAD_DIR}${gameId}.html`;
    if (!existsSync(filePath)) {
      console.error(`${gameId}: SKIP (HTMLファイルが無い: ${filePath})`);
      skippedForReview.push(gameId);
      continue;
    }

    const html = readFileSync(filePath, "utf8");
    const result = parseGamePage(html, gameId);

    if ("error" in result) {
      console.error(`${gameId}: SKIP (PARSE ERROR): ${result.error}`);
      skippedForReview.push(gameId);
      continue;
    }
    if (result.warnings.length > 0) {
      console.error(`${gameId}: SKIP (WARNINGS):`, result.warnings);
      skippedForReview.push(gameId);
      continue;
    }

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
      skippedForReview.push(gameId);
      continue;
    }

    for (const b of result.batters) {
      const name = resolveName(b.playerName);
      if (!existingPlayers.has(name)) newPlayers.add(name);
    }
    for (const p of result.pitchers) {
      const name = resolveName(p.playerName);
      if (!existingPlayers.has(name)) newPlayers.add(name);
    }
    for (const s of result.support) {
      const name = resolveName(s.playerName);
      if (!existingPlayers.has(name)) newPlayers.add(name);
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

  const lines: string[] = [];
  lines.push(`-- ${gameInsertLines.length}試合分の実データ投入（scripts/build-games-sql.mts で自動生成）`);
  lines.push("");

  if (newPlayers.size > 0) {
    lines.push("insert into public.players (id, name) values");
    lines.push([...newPlayers].sort().map((n) => `  (${sqlStr(n)}, ${sqlStr(n)})`).join(",\n") + "\non conflict (id) do nothing;");
    lines.push("");
  }

  if (gameInsertLines.length > 0) {
    lines.push("insert into public.games (id, date, start_time, end_time, league, stadium, opponent, scoreboard) values");
    lines.push(gameInsertLines.join(",\n") + ";");
    lines.push("");

    lines.push("insert into public.game_batting_stats (game_id, player_id, order_no, position, plate_results, plate_appearances, at_bats, hits, runs, rbi, steals) values");
    lines.push(battingInsertLines.join(",\n") + ";");
    lines.push("");

    lines.push("insert into public.game_pitching_stats (game_id, player_id, innings, er, runs, batters_faced, strikeouts, walks, hbp, hits_allowed, hr_allowed, pitches, wp, balk, decision, is_starter) values");
    lines.push(pitchingInsertLines.join(",\n") + ";");
    lines.push("");

    if (supportInsertLines.length > 0) {
      lines.push("insert into public.support_stats (game_id, player_id, participate, manage, bench, score, umpire, camera, watch, cheer) values");
      lines.push(supportInsertLines.join(",\n") + ";");
      lines.push("");
    }
  }

  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log("skipped (already in DB):", skipped);
  console.log("skipped for review (parse error/warning/mismatch):", skippedForReview);
  console.log("games:", gameInsertLines.length, "batting:", battingInsertLines.length, "pitching:", pitchingInsertLines.length, "support:", supportInsertLines.length);
  console.log("new players:", [...newPlayers].sort());
}

main();
