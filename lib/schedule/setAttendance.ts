"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/lib/auth/session";

export type SetAttendanceState = { error: string } | undefined;

export async function setAttendance(
  scheduleId: string,
  attendance: "出席" | "欠席" | "未定",
  _prevState: SetAttendanceState,
  _formData: FormData
): Promise<SetAttendanceState> {
  const player = await requireAuth("/schedule");

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_attendance")
    .upsert(
      { schedule_id: scheduleId, player_id: player.id, attendance },
      { onConflict: "schedule_id,player_id" }
    );
  if (error) return { error: "出欠の登録に失敗しました: " + error.message };

  revalidatePath("/schedule");
  revalidatePath("/schedule/rate");
}
