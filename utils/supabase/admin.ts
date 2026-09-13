import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * service_role キーを使う特権クライアント。RLSを無視して auth.users を読める。
 * サーバー専用・絶対にクライアントへ公開しないこと。
 * ログイン時の「選手 → メールアドレス」解決にのみ使う。
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
