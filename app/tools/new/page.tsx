import { requireAdmin } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import ToolForm from "../ToolForm";

type PlayerOption = { id: string; name: string; number: number | null };

export default async function NewToolPage() {
  await requireAdmin("/tools/new");

  const { data: players } = await fetchAllRows<PlayerOption>((from, to) =>
    supabase.from("players").select("id, name, number").range(from, to)
  );

  const sorted = (players ?? []).slice().sort((a, b) => {
    if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
    if (a.number == null) return 1;
    if (b.number == null) return -1;
    return a.number - b.number;
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">道具を登録</h1>
      <ToolForm players={sorted} />
    </div>
  );
}
