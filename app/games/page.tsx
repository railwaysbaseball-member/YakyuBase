import Link from "next/link";

import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import { getCurrentPlayer } from "@/lib/auth/session";

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

export default async function GamesPage() {
  const [{ data: games, error }, player] = await Promise.all([
    fetchAllRows<GameRow>((from, to) =>
      supabase
        .from("games")
        .select("id, date, opponent, league, stadium, scoreboard")
        .order("date", { ascending: false })
        .range(from, to)
    ),
    getCurrentPlayer(),
  ]);

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">試合結果</h1>
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <span className="text-sm text-foreground/50">
              {rows.length}試合 {record.win}勝{record.loss}敗
              {record.draw > 0 ? `${record.draw}分` : ""}
            </span>
          )}
          {player?.is_admin && (
            <Link
              href="/games/new"
              className="rounded-md bg-team-red px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright"
            >
              ＋試合を登録
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
          まだ試合結果がありません
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((g) => {
            const total = g.scoreboard?.total;
            const result = resultOf(g);
            return (
              <Link
                key={g.id}
                href={`/games/${g.id}`}
                className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-shadow hover:shadow-md"
              >
                <span className="w-20 shrink-0 text-xs font-medium text-foreground/50">
                  {g.date}
                </span>

                {result && (
                  <span
                    className={`w-7 shrink-0 rounded py-0.5 text-center text-xs font-bold ${RESULT_CLASS[result]}`}
                  >
                    {RESULT_LABEL[result]}
                  </span>
                )}

                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  vs {g.opponent}
                </span>

                {total && (
                  <span className="shrink-0 font-mono text-base font-bold tabular-nums">
                    {total.team}
                    <span className="mx-0.5 text-foreground/30">-</span>
                    {total.opponent}
                  </span>
                )}

                <span className="hidden w-40 shrink-0 truncate text-xs text-foreground/50 sm:block">
                  {g.league ?? g.stadium ?? ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
