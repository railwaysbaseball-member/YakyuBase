-- ============================================================
-- 0009_player_login_email.sql
-- ログインフォームの「選手をプルダウンで選ぶ」方式に対応するための関数。
--
-- 背景: Supabase Auth の signInWithPassword はメールアドレスが必須だが、
-- players テーブルにはメールアドレスを持たせていない（anon に公開される
-- players に email 列を足すと、anon キーだけで全選手のメールが読めて
-- しまうため）。service_role キーで auth.users を直接読む案もあるが、
-- このプロジェクトは「service_role キーはリポジトリに置かない・anon
-- キーのみで運用する」方針（supabase/README.md参照）のため、0001の
-- is_admin() / current_player_id() と同じ SECURITY DEFINER 関数で
-- 「指定した1人分のメールアドレスだけ」を返す形にする。
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に全文貼り付けて実行。
-- 何度実行しても安全（べき等）。
-- ============================================================

create or replace function public.player_login_email(p_player_id text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select u.email
  from public.players p
  join auth.users u on u.id = p.user_id
  where p.id = p_player_id;
$$;

-- ログインフォームは未ログイン状態（anon）から呼ぶ。1回の呼び出しでは
-- 指定した player_id 1件分のメールしか返らないため、一覧取得はできない。
grant execute on function public.player_login_email(text) to anon, authenticated;
