import { requireAdmin } from "@/lib/auth/session";
import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import ScheduleForm from "./ScheduleForm";

type ScheduleOption = { opponent: string | null; place: string | null };

export default async function NewSchedulePage() {
  await requireAdmin("/schedule/new");

  const { data: schedules } = await fetchAllRows<ScheduleOption>((from, to) =>
    supabase.from("team_schedule").select("opponent, place").range(from, to)
  );

  const opponentOptions = [
    ...new Set((schedules ?? []).map((s) => s.opponent).filter((v): v is string => Boolean(v))),
  ].sort();
  const placeOptions = [
    ...new Set((schedules ?? []).map((s) => s.place).filter((v): v is string => Boolean(v))),
  ].sort();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">予定を登録</h1>
      <ScheduleForm opponentOptions={opponentOptions} placeOptions={placeOptions} />
    </div>
  );
}
