"use server";

import { randomUUID } from "node:crypto";
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
  const { data: existing, error: selectError } = await supabase
    .from("schedule_attendance")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("player_id", player.id)
    .maybeSingle();
  if (selectError) {
    return { error: "出欠状況の確認に失敗しました: " + selectError.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("schedule_attendance")
      .update({ attendance })
      .eq("id", existing.id);
    if (error) return { error: "出欠の更新に失敗しました: " + error.message };
  } else {
    const { error } = await supabase.from("schedule_attendance").insert({
      id: randomUUID(),
      schedule_id: scheduleId,
      player_id: player.id,
      attendance,
    });
    if (error) return { error: "出欠の登録に失敗しました: " + error.message };
  }

  revalidatePath("/schedule");
  revalidatePath("/schedule/rate");
}
