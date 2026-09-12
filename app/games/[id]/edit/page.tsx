import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import { gameToFormState } from "@/lib/games/gameToFormState";
import GameEntryForm from "../../new/GameEntryForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

type PlayerOption = { id: string; name: string; number: number | null };
type GameOption = { opponent: string | null; stadium: string | null };

export default async function EditGamePage({ params }: PageProps) {
  const { id: gameId } = await params;
  await requireAdmin(`/games/${gameId}/edit`);

  const [
    { data: game, error: gameError },
    { data: battingRows, error: battingError },
    { data: pitchingRows, error: pitchingError },
    { data: supportRows, error: supportError },
    { data: players },
    { data: games },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("date, start_time, end_time, league, stadium, opponent, scoreboard")
      .eq("id", gameId)
      .single(),
    supabase
      .from("game_batting_stats")
      .select("player_id, order_no, position, plate_results")
      .eq("game_id", gameId),
    supabase
      .from("game_pitching_stats")
      .select(
        "player_id, innings, er, runs, batters_faced, strikeouts, walks, hbp, hits_allowed, hr_allowed, pitches, wp, balk, decision, is_starter"
      )
      .eq("game_id", gameId),
    supabase
      .from("support_stats")
      .select("player_id, participate, manage, bench, score, umpire, camera, watch, cheer")
      .eq("game_id", gameId),
    fetchAllRows<PlayerOption>((from, to) =>
      supabase.from("players").select("id, name, number").range(from, to)
    ),
    fetchAllRows<GameOption>((from, to) =>
      supabase.from("games").select("opponent, stadium").range(from, to)
    ),
  ]);

  if (gameError || !game) {
    notFound();
  }
  if (battingError || pitchingError || supportError) {
    console.error(battingError, pitchingError, supportError);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const playerList = (players ?? [])
    .slice()
    .sort((a, b) => {
      if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
      if (a.number == null) return 1;
      if (b.number == null) return -1;
      return a.number - b.number;
    });

  const opponentOptions = [
    ...new Set((games ?? []).map((g) => g.opponent).filter((v): v is string => Boolean(v))),
  ].sort();
  const stadiumOptions = [
    ...new Set((games ?? []).map((g) => g.stadium).filter((v): v is string => Boolean(v))),
  ].sort();

  const initialData = gameToFormState(game, battingRows ?? [], pitchingRows ?? [], supportRows ?? []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">試合を編集</h1>
      <GameEntryForm
        mode="edit"
        gameId={gameId}
        initialData={initialData}
        players={playerList}
        opponentOptions={opponentOptions}
        stadiumOptions={stadiumOptions}
      />
    </div>
  );
}
