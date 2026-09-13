"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type DeleteScheduleState = { error: string } | undefined;

export async function deleteSchedule(
  scheduleId: string,
  _prevState: DeleteScheduleState,
  _formData: FormData
): Promise<DeleteScheduleState> {
  await requireAdmin("/schedule");

  const supabase = await createClient();

  const { error: attendanceError } = await supabase
    .from("schedule_attendance")
    .delete()
    .eq("schedule_id", scheduleId);
  if (attendanceError) {
    return { error: "出欠情報の削除に失敗しました: " + attendanceError.message };
  }

  const { error: scheduleError } = await supabase.from("team_schedule").delete().eq("id", scheduleId);
  if (scheduleError) {
    return { error: "予定の削除に失敗しました: " + scheduleError.message };
  }

  revalidatePath("/schedule");
  redirect("/schedule");
}
