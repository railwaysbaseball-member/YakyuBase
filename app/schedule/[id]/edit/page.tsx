import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import type { TeamSchedule } from "@/types/schedule";
import ScheduleForm from "../../new/ScheduleForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ScheduleOption = { opponent: string | null; place: string | null };

export default async function EditSchedulePage({ params }: PageProps) {
  const { id } = await params;
  await requireAdmin(`/schedule/${id}/edit`);

  const [{ data: schedule, error }, { data: schedules }] = await Promise.all([
    supabase.from("team_schedule").select("*").eq("id", id).maybeSingle(),
    fetchAllRows<ScheduleOption>((from, to) =>
      supabase.from("team_schedule").select("opponent, place").range(from, to)
    ),
  ]);

  if (error || !schedule) {
    notFound();
  }

  const opponentOptions = [
    ...new Set((schedules ?? []).map((s) => s.opponent).filter((v): v is string => Boolean(v))),
  ].sort();
  const placeOptions = [
    ...new Set((schedules ?? []).map((s) => s.place).filter((v): v is string => Boolean(v))),
  ].sort();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">予定を編集</h1>
      <ScheduleForm
        mode="edit"
        scheduleId={id}
        initial={schedule as TeamSchedule}
        opponentOptions={opponentOptions}
        placeOptions={placeOptions}
      />
    </div>
  );
}
