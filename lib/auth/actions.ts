"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { supabase as anonSupabase } from "@/utils/supabaseClient";

export type LoginState = { error: string } | undefined;

export async function signIn(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const playerId = String(formData.get("playerId") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!playerId || !password) {
    return { error: "選手とパスワードを入力してください。" };
  }

  const { data: player, error: playerError } = await anonSupabase
    .from("players")
    .select("user_id")
    .eq("id", playerId)
    .maybeSingle();
  if (playerError || !player?.user_id) {
    return { error: "選手またはパスワードが正しくありません。" };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY が未設定のためログインできません。");
    return { error: "ログイン機能が設定されていません。管理者に連絡してください。" };
  }

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(player.user_id);
  const email = userData?.user?.email;
  if (userError || !email) {
    return { error: "選手またはパスワードが正しくありません。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "選手またはパスワードが正しくありません。" };
  }

  redirect(next || "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
