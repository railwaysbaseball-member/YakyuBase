import { requireAdmin } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import GameEntryForm from "./GameEntryForm";

export default async function NewGamePage() {
  await requireAdmin("/games/new");

  const [{ data: players }, { data: games }] = await Promise.all([
    supabase.from("players").select("id, name, number"),
    supabase.from("games").select("opponent, stadium"),
  ]);

  const playerList = (players ?? [])
    .slice()
    .sort((a, b) => {
      if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
      if (a.number == null) return 1;
      if (b.number == null) return -1;
      return a.number - b.number;
    });

  const opponentOptions = [...new Set((games ?? []).map((g) => g.opponent).filter(Boolean))].sort();
  const stadiumOptions = [...new Set((games ?? []).map((g) => g.stadium).filter(Boolean))].sort();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">試合を登録</h1>
      <GameEntryForm players={playerList} opponentOptions={opponentOptions} stadiumOptions={stadiumOptions} />
    </div>
  );
}
