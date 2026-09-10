import Link from "next/link";

import { supabase } from "@/utils/supabaseClient";
import { getCurrentPlayer } from "@/lib/auth/session";
import type { PlateResult } from "@/types/plateResult";
import DeleteGameButton from "./DeleteGameButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

type GameDetail = {
  id: string;
  date: string;
  opponent: string;
  stadium: string | null;
  start_time: string | null;
  end_time: string | null;
  league: string | null;
  scoreboard: {
    innings: { team: (number | null)[]; opponent: (number | null)[] };
    total: { team: number; opponent: number };
  };
};

// 表記は「方向+結果」の末尾1文字で分類する（calcBatting と同じルール。
// res.includes("安") 等の部分一致だと「遊内」「中三」「左本」を見逃す）。
function resultClass(result: string): string {
  const lastChar = result.slice(-1);
  if (["安", "内", "バ", "二", "三", "本"].includes(lastChar)) {
    return lastChar === "二" || lastChar === "三" || lastChar === "本"
      ? "bg-team-gold-soft text-team-gold"
      : "bg-win/10 text-win";
  }
  if (result.includes("四球")) return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (result.includes("死球")) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (result.includes("犠")) return "bg-sky-500/10 text-sky-700 dark:text-sky-300"; // 犠打・犠飛
  return "bg-loss/10 text-loss";
}

export default async function GameDetailPage({ params }: PageProps) {
  const { id: gameId } = await params;

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  const { data: batting, error: battingError } = await supabase
    .from("game_batting_stats")
    .select("*, players(name)")
    .eq("game_id", gameId)
    .order("order_no", { ascending: true });

  const { data: pitching, error: pitchingError } = await supabase
    .from("game_pitching_stats")
    .select("*, players(name)")
    .eq("game_id", gameId);

  const player = await getCurrentPlayer();

  if (gameError || battingError || pitchingError || !game || !batting || !pitching) {
    console.error(gameError, battingError, pitchingError);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const g = game as GameDetail;

  // イニング列を動的に構築する。
  // 打線が一周する大量得点イニングでは同じイニングに2打席以上入ることがあるため、
  // 単純に「1〜最大イニング」を並べるだけでは足りない。イニングごとに
  // 「そのイニングで最も多く打席に立った選手の回数」分だけ列を用意し、
  // 同じイニング番号の列を必要な数だけ繰り返す（Railsways サイトの表記と同じ）。
  const inningPaCounts = new Map<number, number>();
  for (const b of batting) {
    const perInning = new Map<number, number>();
    for (const pr of (b.plate_results ?? []) as PlateResult[]) {
      perInning.set(pr.inning, (perInning.get(pr.inning) ?? 0) + 1);
    }
    for (const [inning, count] of perInning) {
      inningPaCounts.set(inning, Math.max(inningPaCounts.get(inning) ?? 0, count));
    }
  }
  const maxInning = Math.max(1, ...inningPaCounts.keys());
  const inningColumns: number[] = [];
  for (let inn = 1; inn <= maxInning; inn++) {
    const count = inningPaCounts.get(inn) ?? 1;
    for (let i = 0; i < count; i++) inningColumns.push(inn);
  }

  const total = g.scoreboard.total;
  const result = total.team > total.opponent ? "win" : total.team < total.opponent ? "loss" : "draw";
  const RESULT_LABEL = { win: "勝", loss: "負", draw: "分" } as const;
  const RESULT_CLASS = {
    win: "bg-win/10 text-win",
    loss: "bg-loss/10 text-loss",
    draw: "bg-draw/10 text-draw",
  } as const;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-foreground/50">{g.date}</span>
          {player?.is_admin && (
            <div className="flex items-center gap-2">
              <Link
                href={`/games/${gameId}/edit`}
                className="rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-surface-muted"
              >
                編集
              </Link>
              <DeleteGameButton gameId={gameId} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight">vs {g.opponent}</h1>
          <span className={`rounded px-2 py-0.5 text-sm font-bold ${RESULT_CLASS[result]}`}>
            {RESULT_LABEL[result]}
          </span>
        </div>
        <span className="text-xs text-foreground/50">
          {g.league ?? ""}
          {g.stadium ? ` ・ ${g.stadium}` : ""}
          {g.start_time ? ` ・ ${g.start_time.slice(0, 5)}〜${g.end_time?.slice(0, 5) ?? ""}` : ""}
        </span>
      </div>

      <section className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className="w-full min-w-max text-center text-sm tabular-nums">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-foreground/50"></th>
              {g.scoreboard.innings.team.map((_, i) => (
                <th key={i} className="px-3 py-2 font-medium text-foreground/50">
                  {i + 1}
                </th>
              ))}
              <th className="px-3 py-2 font-bold">R</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border-subtle">
              <td className="px-3 py-2 text-left font-semibold text-team-red">レールウェイズ</td>
              {g.scoreboard.innings.team.map((s, i) => (
                <td key={i} className="px-3 py-2">
                  {s ?? ""}
                </td>
              ))}
              <td className="px-3 py-2 text-base font-bold">{total.team}</td>
            </tr>
            <tr className="border-t border-border-subtle">
              <td className="px-3 py-2 text-left font-semibold">{g.opponent}</td>
              {g.scoreboard.innings.opponent.map((s, i) => (
                <td key={i} className="px-3 py-2">
                  {s ?? ""}
                </td>
              ))}
              <td className="px-3 py-2 text-base font-bold">{total.opponent}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">打者成績</h2>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-center text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-2 py-2 font-medium text-foreground/50">打順</th>
                <th className="px-2 py-2 font-medium text-foreground/50">守備</th>
                <th className="px-3 py-2 text-left font-medium text-foreground/50">選手名</th>
                {inningColumns.map((inn, i) => (
                  <th key={i} className="px-2 py-2 font-medium text-foreground/50">
                    {inn}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium text-foreground/50">打席</th>
                <th className="px-2 py-2 font-medium text-foreground/50">打数</th>
                <th className="px-2 py-2 font-medium text-foreground/50">安打</th>
                <th className="px-2 py-2 font-medium text-foreground/50">得点</th>
                <th className="px-2 py-2 font-medium text-foreground/50">打点</th>
                <th className="px-2 py-2 font-medium text-foreground/50">盗塁</th>
              </tr>
            </thead>
            <tbody>
              {batting.map((b) => {
                const resultsByInning = new Map<number, PlateResult[]>();
                for (const pr of (b.plate_results ?? []) as PlateResult[]) {
                  const arr = resultsByInning.get(pr.inning) ?? [];
                  arr.push(pr);
                  resultsByInning.set(pr.inning, arr);
                }
                const consumed = new Map<number, number>();

                return (
                  <tr key={b.id} className="border-t border-border-subtle">
                    <td className="px-2 py-2">{b.order_no}</td>
                    <td className="px-2 py-2 text-xs text-foreground/60">{b.position ?? ""}</td>
                    <td className="px-3 py-2 text-left font-medium">{b.players?.name}</td>

                    {inningColumns.map((inn, colIdx) => {
                      const usedCount = consumed.get(inn) ?? 0;
                      const pr = resultsByInning.get(inn)?.[usedCount];
                      consumed.set(inn, usedCount + 1);

                      if (!pr) return <td key={colIdx}></td>;

                      return (
                        <td key={colIdx} className="px-1 py-1.5">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${resultClass(pr.result)}`}
                          >
                            {pr.result}
                            {pr.rbi ? `(${pr.rbi})` : ""}
                            {pr.run ? "●" : ""}
                          </span>
                        </td>
                      );
                    })}

                    <td className="px-2 py-2">{b.plate_appearances}</td>
                    <td className="px-2 py-2">{b.at_bats}</td>
                    <td className="px-2 py-2">{b.hits}</td>
                    <td className="px-2 py-2">{b.runs}</td>
                    <td className="px-2 py-2">{b.rbi}</td>
                    <td className="px-2 py-2">{b.steals}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">投手成績</h2>
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full min-w-max text-center text-sm tabular-nums">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground/50">選手</th>
                <th className="px-2 py-2 font-medium text-foreground/50">投球回</th>
                <th className="px-2 py-2 font-medium text-foreground/50">自責点</th>
                <th className="px-2 py-2 font-medium text-foreground/50">失点</th>
                <th className="px-2 py-2 font-medium text-foreground/50">打者数</th>
                <th className="px-2 py-2 font-medium text-foreground/50">奪三振</th>
                <th className="px-2 py-2 font-medium text-foreground/50">四球</th>
                <th className="px-2 py-2 font-medium text-foreground/50">死球</th>
                <th className="px-2 py-2 font-medium text-foreground/50">被安打</th>
                <th className="px-2 py-2 font-medium text-foreground/50">被本打</th>
                <th className="px-2 py-2 font-medium text-foreground/50">投球数</th>
                <th className="px-2 py-2 font-medium text-foreground/50">暴投</th>
                <th className="px-2 py-2 font-medium text-foreground/50">ボーク</th>
                <th className="px-2 py-2 font-medium text-foreground/50">勝敗</th>
              </tr>
            </thead>
            <tbody>
              {pitching.map((p) => (
                <tr key={p.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2 text-left font-medium">{p.players?.name}</td>
                  <td className="px-2 py-2">{p.innings}</td>
                  <td className="px-2 py-2">{p.er ?? 0}</td>
                  <td className="px-2 py-2">{p.runs}</td>
                  <td className="px-2 py-2">{p.batters_faced}</td>
                  <td className="px-2 py-2">{p.strikeouts}</td>
                  <td className="px-2 py-2">{p.walks}</td>
                  <td className="px-2 py-2">{p.hbp}</td>
                  <td className="px-2 py-2">{p.hits_allowed}</td>
                  <td className="px-2 py-2">{p.hr_allowed}</td>
                  <td className="px-2 py-2">{p.pitches}</td>
                  <td className="px-2 py-2">{p.wp}</td>
                  <td className="px-2 py-2">{p.balk}</td>
                  <td className="px-2 py-2 font-semibold">{p.decision ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
