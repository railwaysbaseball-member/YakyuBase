import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import ToolForm from "../../ToolForm";
import type { TeamTool } from "@/types/tools";

type PageProps = {
  params: Promise<{ id: string }>;
};

type PlayerOption = { id: string; name: string; number: number | null };

export default async function EditToolPage({ params }: PageProps) {
  const { id: toolId } = await params;
  await requireAdmin(`/tools/${toolId}/edit`);

  const sessionSupabase = await createClient();
  const [{ data: tool, error }, { data: players }] = await Promise.all([
    sessionSupabase.from("team_tools").select("*").eq("id", toolId).single(),
    fetchAllRows<PlayerOption>((from, to) =>
      supabase.from("players").select("id, name, number").range(from, to)
    ),
  ]);

  if (error || !tool) {
    notFound();
  }

  const t = tool as TeamTool;
  const sorted = (players ?? []).slice().sort((a, b) => {
    if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
    if (a.number == null) return 1;
    if (b.number == null) return -1;
    return a.number - b.number;
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">道具を編集</h1>
      <ToolForm
        mode="edit"
        toolId={toolId}
        players={sorted}
        initialData={{
          toolName: t.tool_name,
          description: t.description ?? "",
          imageUrl: t.image_url ?? "",
          ownerPlayerId: t.owner_player_id ?? "",
        }}
      />
    </div>
  );
}
