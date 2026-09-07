// Railsways (bb.miguee.net/railways1995) の試合詳細ページHTMLを構造化データにパースする。
// game-136 を手作業で書き起こした結果と完全一致することを確認済みのルールを一般化したもの。

export type ParsedPlateResult = {
  inning: number;
  result: string;
  run?: boolean;
  rbi?: number;
  steal?: number;
  advancing_hit?: boolean;
  caught_stealing?: boolean;
  picked_off?: boolean;
};

export type ParsedBatter = {
  order: number;
  position: string;
  playerName: string;
  results: ParsedPlateResult[];
  expected: { pa: number; ab: number; hits: number; runs: number; rbi: number; steals: number };
};

export type ParsedPitcher = {
  playerName: string;
  innings: number;
  er: number;
  runs: number;
  battersFaced: number;
  strikeouts: number;
  walks: number;
  hbp: number;
  hitsAllowed: number;
  hrAllowed: number;
  pitches: number;
  wp: number;
  balk: number;
  decision: "W" | "L" | "S" | "H" | null;
  isStarter: boolean;
};

export type ParsedSupport = {
  playerName: string;
  role: "participate" | "manage" | "bench" | "score" | "umpire" | "camera" | "watch" | "cheer";
};

export type ParsedGame = {
  gameId: string;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  league: string | null; // 例: "公式戦 淀川おむすびリーグ"
  stadium: string | null;
  opponent: string;
  scoreboard: {
    innings: { team: number[]; opponent: number[] };
    total: { team: number; opponent: number };
  };
  batters: ParsedBatter[];
  pitchers: ParsedPitcher[];
  support: ParsedSupport[];
  warnings: string[];
};

const POSITION_MAP: Record<string, string> = {
  box1: "投手",
  box2: "捕手",
  box3: "一塁",
  box4: "二塁",
  box5: "三塁",
  box6: "遊撃",
  box7: "左翼",
  box8: "中堅",
  box9: "右翼",
  box_dh: "DH",
  box_ph: "代打",
  box_pr: "代走",
  box_dp: "DP", // DP-FLEX制のDP（指名選手）。alt属性が無く確証は無いが標準的な略称として採用
};

// td/th を単純な非ネスト前提で1個ずつ切り出す（<img>/<a>/<span>はネストしても</td>は含まないため安全）
function splitCells(rowHtml: string, tag: "td" | "th"): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const cells: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml))) {
    cells.push(m[1]);
  }
  return cells;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, "")).trim();
}

// セル内の生テキストから 打点(丸数字) / 得点(●) / 盗塁等フラグ(sox) を末尾から順不同で剥がす
function parseResultCell(rawHtml: string, warnings: string[], context: string): ParsedPlateResult["result"] extends never ? never : {
  result: string;
  rbi?: number;
  run?: boolean;
  steal?: number;
  advancing_hit?: boolean;
  caught_stealing?: boolean;
  picked_off?: boolean;
} {
  // 勝利打点アイコン(<img ...v2.gif>)は無視して構わない(winning_rbiは今回のスキーマでは省略)
  let text = stripTags(rawHtml);
  const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

  let rbi: number | undefined;
  let run = false;
  let allFlags = "";

  let changed = true;
  while (changed) {
    changed = false;
    // 末尾の半角アルファベット連続はすべて「フラグ」として一旦剥がす。
    // 既知(s=盗塁,o=進塁打,x=盗塁死)以外の文字(例: "k")も凡例に無いまま
    // 実データに登場するため、意味を勝手に決めず未知フラグとして警告に残す。
    const flagMatch = text.match(/([a-zA-Z]+)$/);
    if (flagMatch) {
      allFlags = flagMatch[1] + allFlags;
      text = text.slice(0, -flagMatch[1].length);
      changed = true;
      continue;
    }
    if (text.endsWith("●")) {
      run = true;
      text = text.slice(0, -1);
      changed = true;
      continue;
    }
    const lastChar = text.slice(-1);
    const circledIdx = CIRCLED.indexOf(lastChar);
    if (circledIdx >= 0) {
      rbi = circledIdx + 1;
      text = text.slice(0, -1);
      changed = true;
      continue;
    }
  }

  const steal = (allFlags.match(/s/g) ?? []).length || undefined;
  const advancing_hit = allFlags.includes("o") || undefined;
  const caught_stealing = allFlags.includes("x") || undefined;
  const picked_off = allFlags.includes("k") || undefined; // k=牽制死（凡例には無いが実データで確認済み）
  const unknownFlags = allFlags.replace(/[soxk]/g, "");
  if (unknownFlags) {
    warnings.push(`[${context}] 未知のフラグ文字 "${unknownFlags}" (result="${text}", raw="${rawHtml}") — 凡例に無いため無視して結果テキストのみ採用`);
  }

  if (!text) {
    warnings.push(`[${context}] 結果テキストが空になった (raw="${rawHtml}", flags="${allFlags}")`);
  }

  return { result: text, rbi, run: run || undefined, steal, advancing_hit, caught_stealing, picked_off };
}

function parseInnings(text: string): number {
  // "0回1/3" "1回2/3" "3回0/3" のような表記を 0.1 / 1.2 / 3.0 に変換
  const m = text.match(/^(\d+)回\(?(\d)\/3\)?$/);
  if (!m) return NaN;
  return Number(m[1]) + Number(m[2]) / 10;
}

export function parseGamePage(html: string, gameId: string): ParsedGame | { error: string; warnings: string[] } {
  const warnings: string[] = [];

  // --- 試合メタ情報 ---
  // 通常戦は "試合結果 vs 対戦相手 日付"。紅白戦（例: game-2「レールウェイズB vs レールウェイズA」）
  // のような身内対抗戦だけは自チーム名が省略されず "試合結果 チームX vs チームY 日付" になるため、
  // 先頭の任意チーム名を許容する（"vs "の直前まで非貪欲マッチ）。
  const titleMatch = html.match(/\$\("title"\)\.html\("試合結果 (?:\S+ )?vs (.+?) (\d{4}-\d{2}-\d{2})"\)/);
  if (!titleMatch) return { error: "タイトル行が見つからない(対戦相手/日付を特定できない)", warnings };
  const opponent = decodeEntities(titleMatch[1]);
  const date = titleMatch[2];

  const timeMatch = html.match(/(\d+)時(\d+)分\s*[〜~]\s*(\d+)時(\d+)分/);
  const startTime = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;
  const endTime = timeMatch ? `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}` : null;

  const typeMatch = html.match(/<th><span class="?bitbig"?>種別<\/span><\/th><td>(?:<img[^>]*alt='([^']*)'[^>]*>)?\s*([^<]*)<\/td>/);
  const league = typeMatch ? decodeEntities(`${typeMatch[1] ?? ""} ${typeMatch[2] ?? ""}`.trim()) || null : null;

  const stadiumMatch = html.match(/<th><span class=bitbig>球場<\/span><\/th><td><span class=bitbig>([^<]*)<\/span><\/td>/);
  const stadium = stadiumMatch ? decodeEntities(stadiumMatch[1]) : null;

  // --- スコアボード ---
  const scboardMatch = html.match(/<table class=scboard>([\s\S]*?)<\/table>/);
  if (!scboardMatch) return { error: "スコアボードが見つからない", warnings };
  const scRows = [...scboardMatch[1].matchAll(/<tr class="scrrow\d">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  if (scRows.length < 3) return { error: `スコアボードの行数が想定外 (${scRows.length})`, warnings };

  function parseScoreRow(rowHtml: string) {
    const cells = splitCells(rowHtml, "td");
    const teamName = stripTags(cells[0] ?? "");
    const total = Number(stripTags(cells[cells.length - 1] ?? "0"));
    const innings = cells.slice(1, -1).map((c) => Number(stripTags(c) || "0"));
    return { teamName, innings, total };
  }
  const rowA = parseScoreRow(scRows[1]);
  const rowB = parseScoreRow(scRows[2]);
  // 「レールウェイズ・ブルース合同チーム」のような合同チーム戦では
  // 完全一致ではなくチーム名が「レールウェイズ」で始まるかで判定する。
  const isOurTeam = (name: string) => name.startsWith("レールウェイズ");
  const teamRow = isOurTeam(rowA.teamName) ? rowA : rowB;
  const oppRow = isOurTeam(rowA.teamName) ? rowB : rowA;
  if (!isOurTeam(teamRow.teamName)) {
    warnings.push(`スコアボードに「レールウェイズ」の行が見つからない (rowA=${rowA.teamName}, rowB=${rowB.teamName})`);
  }

  const scoreboard = {
    innings: { team: teamRow.innings, opponent: oppRow.innings },
    total: { team: teamRow.total, opponent: oppRow.total },
  };

  // --- 打者成績テーブル ---
  // 「試合内容」等の自由記述欄に "打者成績"/"投手成績" という言葉が偶然登場することがある
  // （例: 「投手成績のみ失点と自責点を変更しました」という訂正コメント）ため、
  // 単純なテキスト検索ではなく見出し要素そのもの(<span class=bitbig>打者成績</span>)を起点にする。
  // 紅白戦（例: game-2）では自チームの2チーム分の見出し・テーブルが1ページに存在するため、
  // 最初の1件だけでなく全件を拾って選手をマージする（通常戦では常に1件のみヒットする）。
  function parseBattingTable(tableHtml: string, tableIdx: number): ParsedBatter[] {
    const headerMatch = tableHtml.match(/<tr>([\s\S]*?)<\/tr>/);
    if (!headerMatch) {
      warnings.push(`打者成績テーブル(${tableIdx})のヘッダー行が見つからない`);
      return [];
    }
    const headerCells = splitCells(headerMatch[1], "th");
    // ヘッダーは 打順,守備,選手名, (イニング列×N, id='batin'), 打席,打数,安打,得点,打点,盗塁 の順。
    // イニング列の数はテーブルごとに変わるため、末尾6つ(打席〜盗塁)を除いた3列目以降がイニング列。
    const inningLabels = headerCells.slice(3, headerCells.length - 6).map((c) => Number(stripTags(c)));

    const result: ParsedBatter[] = [];
    const bodyRows = [...tableHtml.matchAll(/<tr><th>(\d+)<\/th>([\s\S]*?)<\/tr>/g)];
    for (const rowMatch of bodyRows) {
      const order = Number(rowMatch[1]);
      const rowHtml = rowMatch[2];
      const tds = splitCells(rowHtml, "td");
      // tds[0] = 守備位置アイコン群, tds[1] = 選手名, tds[2..2+N-1] = イニング列, 残り6個 = 統計列
      const positionIcons = [...tds[0].matchAll(/box[a-z0-9_]+/g)].map((m) => m[0]);
      const position = positionIcons.map((p) => POSITION_MAP[p] ?? p).join("/");
      const playerName = stripTags(tds[1]);

      const inningCellCount = inningLabels.length;
      const inningCells = tds.slice(2, 2 + inningCellCount);
      const statCells = tds.slice(2 + inningCellCount);
      if (statCells.length !== 6) {
        warnings.push(`[order${order} ${playerName}] 統計列の数が想定外 (${statCells.length})`);
      }

      const results: ParsedPlateResult[] = [];
      inningCells.forEach((cellHtml, i) => {
        const text = stripTags(cellHtml);
        if (!text) return;
        const parsed = parseResultCell(cellHtml, warnings, `order${order} ${playerName} inn${inningLabels[i]}`);
        results.push({ inning: inningLabels[i], ...parsed });
      });

      const nums = statCells.map((c) => {
        const t = stripTags(c);
        return t === "" ? 0 : Number(t);
      });

      result.push({
        order,
        position,
        playerName,
        results,
        expected: { pa: nums[0] ?? 0, ab: nums[1] ?? 0, hits: nums[2] ?? 0, runs: nums[3] ?? 0, rbi: nums[4] ?? 0, steals: nums[5] ?? 0 },
      });
    }
    return result;
  }

  const battingSectionMatches = [
    ...html.matchAll(/<span class="?bitbig"?>打者成績<\/span>[\s\S]*?<table class='tinfo pers_res add_bs bframe_mL'[^>]*>([\s\S]*?)<\/table>/g),
  ];
  const batters: ParsedBatter[] = [];
  if (battingSectionMatches.length === 0) {
    warnings.push("打者成績テーブルが見つからない");
  } else {
    battingSectionMatches.forEach((m, i) => batters.push(...parseBattingTable(m[1], i)));
  }

  // --- 投手成績テーブル ---
  // 打者成績と同様、紅白戦では2チーム分のテーブルが存在するため全件を拾ってマージする。
  // 「先発」判定(isStarter)は各テーブルの先頭行を基準にするため、テーブルごとに独立して計算する。
  function parsePitchingTable(tableHtml: string): ParsedPitcher[] {
    const result: ParsedPitcher[] = [];
    const bodyRows = [...tableHtml.matchAll(/<tr>((?:(?!<tr>)[\s\S])*?)<\/tr>/g)].slice(1); // 先頭はヘッダー行
    bodyRows.forEach((rowMatch, idx) => {
      const tds = splitCells(rowMatch[1], "td");
      if (tds.length < 14) return;
      const playerName = stripTags(tds[0]);
      const innings = parseInnings(stripTags(tds[1]));
      const decisionText = stripTags(tds[13]);
      let decision: ParsedPitcher["decision"] = null;
      if (/icon_win/.test(tds[13])) decision = "W";
      else if (/icon_lose|icon_los/.test(tds[13])) decision = "L";
      else if (decisionText === "Ｓ" || decisionText === "S") decision = "S";
      else if (decisionText === "Ｈ" || decisionText === "H") decision = "H";
      else if (decisionText !== "") warnings.push(`[投手 ${playerName}] 未知の勝敗表記: "${decisionText}"`);

      result.push({
        playerName,
        innings,
        er: Number(stripTags(tds[2]) || "0"),
        runs: Number(stripTags(tds[3]) || "0"),
        battersFaced: Number(stripTags(tds[4]) || "0"),
        strikeouts: Number(stripTags(tds[5]) || "0"),
        walks: Number(stripTags(tds[6]) || "0"),
        hbp: Number(stripTags(tds[7]) || "0"),
        hitsAllowed: Number(stripTags(tds[8]) || "0"),
        hrAllowed: Number(stripTags(tds[9]) || "0"),
        pitches: Number(stripTags(tds[10]) || "0"),
        wp: Number(stripTags(tds[11]) || "0"),
        balk: Number(stripTags(tds[12]) || "0"),
        decision,
        isStarter: idx === 0,
      });
    });
    return result;
  }

  const pitchingSectionMatches = [
    ...html.matchAll(/<span class="?bitbig"?>投手成績<\/span>[\s\S]*?<table class='tinfo pers_res add_bs bframe_mL'[^>]*>([\s\S]*?)<\/table>/g),
  ];
  const pitchers: ParsedPitcher[] = [];
  if (pitchingSectionMatches.length === 0) {
    warnings.push("投手成績テーブルが見つからない");
  } else {
    pitchingSectionMatches.forEach((m) => pitchers.push(...parsePitchingTable(m[1])));
  }

  // --- サポート ---
  const supportSectionMatch = html.match(/サポート<\/span>[\s\S]*?<table class="tinfo add_bs"[^>]*>([\s\S]*?)<\/table>/);
  const support: ParsedSupport[] = [];
  const ROLE_MAP: Record<string, ParsedSupport["role"]> = {
    参加: "participate",
    采配: "manage",
    控え: "bench",
    スコア: "score",
    審判: "umpire",
    撮影: "camera",
    見学: "watch",
    応援: "cheer",
  };
  if (supportSectionMatch) {
    const rows = [...supportSectionMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    for (const r of rows) {
      const tds = splitCells(r[1], "td");
      if (tds.length < 2) continue;
      const playerName = stripTags(tds[0]);
      const roleText = stripTags(tds[1]);
      const role = ROLE_MAP[roleText];
      if (!role) {
        warnings.push(`[サポート ${playerName}] 未知の役割: "${roleText}"`);
        continue;
      }
      support.push({ playerName, role });
    }
  }

  return {
    gameId,
    date,
    startTime,
    endTime,
    league,
    stadium,
    opponent,
    scoreboard,
    batters,
    pitchers,
    support,
    warnings,
  };
}
