import Link from "next/link";

import { supabase } from "@/utils/supabaseClient";

type GameRow = {
  id: string;
  date: string;
  opponent: string;
  league: string | null;
  stadium: string | null;
  scoreboard: { total: { team: number; opponent: number } } | null;
};

type Result = "win" | "loss" | "draw";

function resultOf(g: GameRow): Result | null {
  const total = g.scoreboard?.total;
  if (!total) return null;
  if (total.team > total.opponent) return "win";
  if (total.team < total.opponent) return "loss";
  return "draw";
}

const RESULT_LABEL: Record<Result, string> = { win: "勝", loss: "負", draw: "分" };
const RESULT_CLASS: Record<Result, string> = {
  win: "bg-win/10 text-win",
  loss: "bg-loss/10 text-loss",
  draw: "bg-draw/10 text-draw",
};

export default async function Home() {
  const { data: games, error } = await supabase
    .from("games")
    .select("id, date, opponent, league, stadium, scoreboard")
    .order("date", { ascending: false })
    .limit(8);

  if (error) {
    console.error(error);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const rows = (games ?? []) as GameRow[];
  const record = rows.reduce(
    (acc, g) => {
      const r = resultOf(g);
      if (r) acc[r]++;
      return acc;
    },
    { win: 0, loss: 0, draw: 0 }
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <section className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-team-red to-team-red-bright px-6 py-10 text-white sm:px-10">
        <span className="text-sm font-semibold tracking-wide text-white/70">
          RAILWAYS BASEBALL CLUB
        </span>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          レールウェイズ 成績管理
        </h1>
        <p className="max-w-xl text-sm text-white/80">
          草野球チーム「レールウェイズ」の打撃・投手・守備成績、試合結果をまとめています。
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            href="/games"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-team-red transition-colors hover:bg-white/90"
          >
            試合結果を見る
          </Link>
          <Link
            href="/stats"
            className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/20"
          >
            個人成績を見る
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">最新の試合結果</h2>
          <Link href="/games" className="text-sm font-medium text-team-red hover:underline">
            すべて見る →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
            まだ試合結果がありません
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((g) => {
              const total = g.scoreboard?.total;
              const result = resultOf(g);
              return (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground/50">{g.date}</span>
                    {result && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${RESULT_CLASS[result]}`}
                      >
                        {RESULT_LABEL[result]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="truncate text-sm font-semibold">vs {g.opponent}</span>
                    {total && (
                      <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
                        {total.team}
                        <span className="mx-0.5 text-foreground/30">-</span>
                        {total.opponent}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-foreground/50">
                    {g.league ?? g.stadium}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-xs text-foreground/50">
            直近{rows.length}試合: {record.win}勝{record.loss}敗
            {record.draw > 0 ? `${record.draw}分` : ""}
          </p>
        )}
      </section>
    </div>
  );
}
