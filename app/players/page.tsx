import { requireAdmin } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import GuestToggle from "./GuestToggle";

type PlayerRow = { id: string; name: string; number: number | null; is_guest: boolean };

export default async function PlayersPage() {
  await requireAdmin("/players");

  const { data: players } = await fetchAllRows<PlayerRow>((from, to) =>
    supabase.from("players").select("id, name, number, is_guest").range(from, to)
  );

  const sorted = (players ?? []).slice().sort((a, b) => {
    if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
    if (a.number == null) return 1;
    if (b.number == null) return -1;
    return a.number - b.number;
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">選手管理</h1>
        <p className="text-sm text-foreground/50">
          「助っ人」に設定した選手は個人成績（/stats）に表示されなくなります。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3"
          >
            <span className="text-sm font-medium">
              {p.number != null ? `${p.number} ` : ""}
              {p.name}
            </span>
            <GuestToggle playerId={p.id} isGuest={p.is_guest} />
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
            選手が登録されていません
          </p>
        )}
      </div>
    </div>
  );
}
