import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/utils/supabase/server";
import type { Player } from "@/types/player";

/**
 * ログイン中ユーザーに紐づく players レコードを取得する。
 * 未ログイン、または players に紐付けがまだ無い場合は null。
 *
 * React.cache で1リクエスト内のメモ化を行う（Server Components/Actions/
 * Route Handlers から複数回呼んでもDBアクセスは1回）。
 */
export const getCurrentPlayer = cache(async (): Promise<Player | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as Player;
});

/**
 * ログインしていなければ /login へリダイレクトする。
 * ページ・Server Action の先頭で呼ぶ。
 */
export async function requireAuth(nextPath?: string): Promise<Player> {
  const player = await getCurrentPlayer();
  if (!player) {
    const params = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${params}`);
  }
  return player;
}

/**
 * 管理者でなければ /login（未ログイン時）または呼び出し元指定のリダイレクト先へ。
 * 試合結果・成績登録など、管理者専用の書き込み処理の先頭で呼ぶこと。
 *
 * 注意: これはUX目的のガード。実データの最終防衛線はSupabaseのRLS
 * （supabase/migrations/0001_auth_setup.sql の "admin write" ポリシー）。
 */
export async function requireAdmin(nextPath?: string): Promise<Player> {
  const player = await requireAuth(nextPath);
  if (!player.is_admin) {
    redirect("/");
  }
  return player;
}
