"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

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

  const supabase = await createClient();

  // player_id -> メールアドレスの解決は、anon から実行できる SECURITY
  // DEFINER 関数（supabase/migrations/0009）越しに行う。service_role
  // キーは使わない（supabase/README.md の運用方針）。
  const { data: email, error: emailError } = await supabase.rpc("player_login_email", {
    p_player_id: playerId,
  });
  if (emailError || !email) {
    return { error: "選手またはパスワードが正しくありません。" };
  }

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
