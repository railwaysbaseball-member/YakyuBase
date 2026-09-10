"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { nextIdForDate } from "@/lib/nextIdForDate";

export type CreateScheduleState = { error: string } | undefined;

export async function createSchedule(
  _prevState: CreateScheduleState,
  formData: FormData
): Promise<CreateScheduleState> {
  await requireAdmin("/schedule/new");

  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const opponent = String(formData.get("opponent") ?? "").trim();
  const place = String(formData.get("place") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim();
  const umpire = String(formData.get("umpire") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "日付を正しく入力してください。" };
  }
  if (!status) {
    return { error: "種別を選択してください。" };
  }
  if (!title) {
    return { error: "内容を入力してください。" };
  }
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return { error: "出欠締切日を正しく入力してください。" };
  }

  const supabase = await createClient();

  const dateCompact = date.replaceAll("-", "");
  const { data: existing, error: existingError } = await supabase
    .from("team_schedule")
    .select("id")
    .like("id", `sched-${dateCompact}%`);
  if (existingError) {
    return { error: "予定ID採番に失敗しました: " + existingError.message };
  }
  const scheduleId = nextIdForDate("sched", date, (existing ?? []).map((s) => s.id as string));

  const { error: insertError } = await supabase.from("team_schedule").insert({
    id: scheduleId,
    date,
    start_time: startTime || null,
    end_time: endTime || null,
    title,
    opponent: opponent || null,
    place: place || null,
    status: status || null,
    deadline: deadline || null,
    umpire: umpire || null,
    notes: notes || null,
  });
  if (insertError) {
    return { error: "予定の登録に失敗しました: " + insertError.message };
  }

  revalidatePath("/schedule");
  redirect("/schedule");
}
