import Link from "next/link";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import DeleteSeasonParametersButton from "./DeleteSeasonParametersButton";

type SeasonParametersRow = {
  id: string;
  season: number;
  required_pa: number | null;
  required_ip: number | null;
  qs: number | null;
};

export default async function SeasonParametersPage() {
  await requireAdmin("/admin/season-parameters");

  const supabase = await createClient();
  const { data: rows, error } = await fetchAllRows<SeasonParametersRow>((from, to) =>
    supabase
      .from("season_parameters")
      .select("id, season, required_pa, required_ip, qs")
      .range(from, to)
  );

  if (error) {
    console.error(error);
    return <div className="p-4">データ取得エラーが発生しました</div>;
  }

  const sorted = (rows ?? [])
    .slice()
    .sort((a, b) => (a.season === 0 ? -1 : b.season === 0 ? 1 : b.season - a.season));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">年度設定（POINT計算パラメータ）</h1>
        <Link
          href="/admin/season-parameters/new"
          className="rounded-md bg-team-red px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright"
        >
          ＋年度を追加
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-foreground/50">
          年度設定が登録されていません
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {r.season === 0 ? "全年度共通（デフォルト）" : `${r.season}年度`}
                </span>
                <span className="text-xs text-foreground/50">
                  規定打席倍率: {r.required_pa ?? "-"} ・ 規定投球回倍率: {r.required_ip ?? "-"} ・ QS最低投球回:{" "}
                  {r.qs ?? "-"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/season-parameters/${r.id}/edit`}
                  className="text-xs text-foreground/50 underline hover:text-foreground"
                >
                  編集
                </Link>
                {r.season !== 0 && <DeleteSeasonParametersButton id={r.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
