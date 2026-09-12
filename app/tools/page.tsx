import Link from "next/link";

import { requireAuth, getCurrentPlayer } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import DeleteToolButton from "./DeleteToolButton";
import type { TeamTool } from "@/types/tools";

type PlayerOption = { id: string; name: string };

export default async function ToolsPage() {
  await requireAuth("/tools");

  const sessionSupabase = await createClient();
  const [{ data: tools, error }, { data: players }, player] = await Promise.all([
    fetchAllRows<TeamTool>((from, to) => sessionSupabase.from("team_tools").select("*").range(from, to)),
    fetchAllRows<PlayerOption>((from, to) => supabase.from("players").select("id, name").range(from, to)),
    getCurrentPlayer(),
  ]);

  if (error) {
    console.error(error);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const nameById = new Map((players ?? []).map((p) => [p.id, p.name]));
  const rows = (tools ?? []).slice().sort((a, b) => a.tool_name.localeCompare(b.tool_name, "ja"));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">道具管理</h1>
        {player?.is_admin && (
          <Link
            href="/tools/new"
            className="rounded-md bg-team-red px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright"
          >
            ＋道具を登録
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
          道具が登録されていません
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 sm:flex-row"
            >
              {t.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.image_url}
                  alt={t.tool_name}
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t.tool_name}</span>
                  {player?.is_admin && (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tools/${t.id}/edit`}
                        className="text-xs text-foreground/50 underline hover:text-foreground"
                      >
                        編集
                      </Link>
                      <DeleteToolButton toolId={t.id} />
                    </div>
                  )}
                </div>
                {t.description && (
                  <p className="whitespace-pre-wrap text-sm text-foreground/70">{t.description}</p>
                )}
                <span className="text-xs text-foreground/50">
                  管理者: {t.owner_player_id ? (nameById.get(t.owner_player_id) ?? t.owner_player_id) : "未設定"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
