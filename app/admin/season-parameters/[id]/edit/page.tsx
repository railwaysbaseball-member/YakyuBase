import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import type { SeasonParameters } from "@/types/seasonParameters";
import SeasonParametersForm from "../../SeasonParametersForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSeasonParametersPage({ params }: PageProps) {
  const { id } = await params;
  await requireAdmin(`/admin/season-parameters/${id}/edit`);

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("season_parameters")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">年度設定を編集</h1>
      <SeasonParametersForm mode="edit" id={id} initialData={row as SeasonParameters} />
    </div>
  );
}
