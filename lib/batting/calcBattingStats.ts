import type { PlateResult } from "@/types/plateResult";

export type CalculatedBatting = {
  pa: number;          // 打席
  ab: number;          // 打数
  hits: number;        // 安打
  singles: number;     // 単打（内野安打・バント安打を含む）
  infield_hits: number; // 内野安打（singlesの内数。POINT計算で単打と別重み）
  doubles: number;
  triples: number;
  homeruns: number;
  total_bases: number; // 塁打数

  runs: number;        // 得点
  rbi: number;         // 打点
  steals: number;      // 盗塁
  caught_stealing: number; // 盗塁死
  picked_off: number;  // 牽制死
  double_plays: number; // 併殺打
  strikeouts: number;  // 三振
  walks: number;       // 四球
  hbp: number;         // 死球
  sac_bunt: number;    // 犠打
  sac_fly: number;     // 犠飛
  sac: number;         // 犠打 + 犠飛
  advancing_hits: number; // 進塁打
  strike_escapes: number; // 振り逃げ（POINT計算用。打数・三振の集計自体は変えない）
  opponent_errors: number; // 敵失（同上）
  interferences: number; // 打撃妨害（同上）
  fielder_choices: number; // 野選（同上）

  // 率系
  avg: number;         // 打率
  obp: number;         // 出塁率
  slg: number;         // 長打率
  ops: number;         // OPS

  // 得点圏
  risp_ab: number;
  risp_hits: number;
  risp_avg: number;

  // RC27
  rc27: number;
};

export function calcBatting(results: PlateResult[]): CalculatedBatting {
  let pa = 0;
  let ab = 0;
  let hits = 0;
  let singles = 0;
  let infield_hits = 0;
  let doubles = 0;
  let triples = 0;
  let homeruns = 0;

  let runs = 0;
  let rbi = 0;
  let steals = 0;
  let caught_stealing = 0;
  let picked_off = 0;
  let double_plays = 0;
  let strikeouts = 0;
  let walks = 0;
  let hbp = 0;
  let sac_bunt = 0;
  let sac_fly = 0;
  let advancing_hits = 0;
  let strike_escapes = 0;
  let opponent_errors = 0;
  let interferences = 0;
  let fielder_choices = 0;

  // 得点圏
  let risp_ab = 0;
  let risp_hits = 0;

  for (const pr of results) {
    // 得点
    if (pr.run) runs++;

    // 打点
    rbi += pr.rbi ?? 0;

    // 盗塁
    steals += pr.steal ?? 0;

    // 盗塁死・牽制死・併殺打（RC27の「真のアウト数」計算に使う）
    if (pr.caught_stealing) caught_stealing++;
    if (pr.picked_off) picked_off++;
    if (pr.double_play) double_plays++;

    // 進塁打
    if (pr.advancing_hit) advancing_hits++;

    // 「代走」は打席に立たず出塁した走者に代わって入る交代なので、
    // 得点・盗塁等はカウントするが打席・打数には数えない。
    if (pr.result === "代走") continue;

    pa++;

    // 得点圏判定。取得元サイトは「2塁か3塁か」までは区別しておらず、打席結果セルに
    // class='tktnkn' が付くかどうか（凡例:「：得点圏にランナーあり」）でしか
    // 判定できないため、risp は単純な真偽値。
    const risp = !!pr.risp;

    // 打席結果の分類
    const res = pr.result;

    // 四球・死球・犠打・犠飛・打撃妨害 → 打数に含めない。得点圏打率も通常の打率と
    // 同じ基準（四球等を除く「打数」を分母にする）なので risp_ab も増やさない。
    if (res.includes("四球")) {
      walks++;
      continue;
    }
    if (res.includes("死球")) {
      hbp++;
      continue;
    }
    // 打撃妨害（"打妨"のように略記される）→ 四球と同じく打数に含めない
    if (res.includes("妨")) {
      interferences++;
      continue;
    }
    // 「犠打」「犠飛」という語そのものだけでなく、「中犠」「左犠」のような
    // 方向+犠の表記でも記録される。犠打(バント)は内野の守備位置、犠飛は
    // 外野の守備位置に飛ぶため、先頭の方向文字で犠打/犠飛を判別できる。
    if (res.includes("犠")) {
      if (res.includes("犠飛")) sac_fly++;
      else if (res.includes("犠打")) sac_bunt++;
      else if (["左", "中", "右"].includes(res.charAt(0))) sac_fly++;
      else sac_bunt++;
      continue;
    }

    // 三振
    if (res.includes("三振")) {
      strikeouts++;
      ab++;
      if (risp) risp_ab++;
      continue;
    }

    // 安打系
    // 表記は「方向+結果」の2〜3文字（例: 右安, 遊内, 中二, 中三, 左本, 三バ）。
    // 方向の文字（二=二塁手, 三=三塁手 等）と結果の文字が被るため、
    // 判定は必ず末尾1文字で行う（res.includes("安")等の部分一致だと
    // 「遊内」「中三」「左本」のような安打を見逃す）。
    const lastChar = res.slice(-1);
    const isHit =
      lastChar === "安" || // 単打
      lastChar === "内" || // 内野安打
      lastChar === "バ" || // バント安打
      lastChar === "二" || // 二塁打
      lastChar === "三" || // 三塁打
      lastChar === "本"; // 本塁打

    if (isHit) {
      hits++;
      ab++;

      if (lastChar === "二") doubles++;
      else if (lastChar === "三") triples++;
      else if (lastChar === "本") homeruns++;
      else {
        singles++; // 安・内・バ はすべて単打扱い（打率・長打率上は区別しない）
        if (lastChar === "内") infield_hits++; // POINT計算では単打と別重み
      }

      if (risp) {
        risp_ab++;
        risp_hits++;
      }

      continue;
    }

    // 振り逃げ・敵失・野選も打数には含まれる（サイトの実データで確認済み）。
    // 打撃妨害は上で打数除外として処理済みのためここでは対象外。
    // POINT計算用に種別だけ別途カウントする（打数・安打の扱いは変えない）。
    // 野選は実データ上「三野」「投野」「遊野」のように方向+"野"の1文字表記で
    // 記録されており、"野選"という2文字表記そのものは実データに現れない
    // （テストで判明: この分岐が一度もマッチせずfielder_choicesが常に0になっていた）。
    if (res.includes("振逃")) strike_escapes++;
    else if (res.includes("野選") || res.endsWith("野")) fielder_choices++;
    else if (res.includes("敵失") || res.endsWith("失")) opponent_errors++;

    // その他のアウト → 打数に含める
    ab++;
    if (risp) risp_ab++;
  }

  // 打率
  const avg = ab > 0 ? hits / ab : 0;

  // 出塁率
  const sac = sac_bunt + sac_fly;
  const obp = (hits + walks + hbp) / (ab + walks + hbp + sac || 1);

  // 長打率
  const slg = (singles + doubles * 2 + triples * 3 + homeruns * 4) / (ab || 1);

  // OPS
  const ops = obp + slg;

  // 得点圏打率
  const risp_avg = risp_ab > 0 ? risp_hits / risp_ab : 0;

  // RC27（Runs Created per 27 outs）
  // Bill James の Basic RC（(H+BB)*TB/(AB+BB)）を「真のアウト数」あたりに換算する。
  // 打数(AB)をそのまま分母にすると、盗塁死・併殺打で追加的に生まれるアウトを
  // 数え漏らすため、Outs = AB - 安打 + 盗塁死 + 併殺打 で計算する。
  const totalBases = singles + doubles * 2 + triples * 3 + homeruns * 4;
  const rc = ((hits + walks) * totalBases) / (ab + walks || 1);
  const outs = ab - hits + caught_stealing + double_plays;
  const rc27 = outs > 0 ? (rc * 27) / outs : 0;

  return {
    pa,
    ab,
    hits,
    singles,
    infield_hits,
    doubles,
    triples,
    homeruns,
    total_bases: totalBases,
    runs,
    rbi,
    steals,
    caught_stealing,
    picked_off,
    double_plays,
    strikeouts,
    walks,
    hbp,
    sac_bunt,
    sac_fly,
    sac,
    advancing_hits,
    strike_escapes,
    opponent_errors,
    interferences,
    fielder_choices,
    avg,
    obp,
    slg,
    ops,
    risp_ab,
    risp_hits,
    risp_avg,
    rc27,
  };
}
