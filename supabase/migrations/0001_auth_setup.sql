-- ============================================================
-- 0001_auth_setup.sql
-- Supabase Auth 導入: players と auth.users の紐付け・管理者フラグ・RLS
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に全文貼り付けて実行。
-- 何度実行しても安全なように書いてある（べき等）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. players に認証連携用カラムを追加
--    user_id: auth.users への参照。ログインアカウントと選手を1:1で紐付ける
--    is_admin: true の場合、試合結果・成績・スケジュール等の登録/編集が可能
-- ------------------------------------------------------------
alter table public.players
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_admin boolean not null default false;

create unique index if not exists players_user_id_key
  on public.players (user_id)
  where user_id is not null;

-- ------------------------------------------------------------
-- 2. 管理者判定ヘルパー関数
--    RLSポリシー内で使い回す。SECURITY DEFINER で players 自身を参照する際の
--    RLS再帰(無限ループ)を回避する。
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select p.is_admin from public.players p where p.user_id = auth.uid()),
    false
  );
$$;

-- ログイン中ユーザーに紐づく player.id を返すヘルパー（出欠の本人判定などに使用）
create or replace function public.current_player_id()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select p.id from public.players p where p.user_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 3. anon / authenticated ロールへの GRANT
--    handover.md の「追加テーブル」は SQL で直接作られたため、Supabase の
--    テーブルエディタ経由と違い PostgREST 用の GRANT が付与されていない。
--    ここで明示的に付与する（行単位の制御は RLS ポリシー側で行う）。
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- 公開読み取り対象（現行サイトで非ログインでも閲覧できるもの）
grant select on public.players               to anon, authenticated;
grant select on public.games                  to anon, authenticated;
grant select on public.game_batting_stats     to anon, authenticated;
grant select on public.game_pitching_stats    to anon, authenticated;
grant select on public.game_fielding_stats    to anon, authenticated;
grant select on public.season_parameters      to anon, authenticated;
grant select on public.support_stats          to anon, authenticated;
grant select on public.team_schedule          to anon, authenticated;

-- メンバー限定（ログインユーザーのみ閲覧: 道具管理・出欠明細）
grant select on public.team_tools             to authenticated;
grant select on public.schedule_attendance    to authenticated;

-- 書き込みは authenticated ロールに許可し、実際の可否は RLS ポリシー(管理者/本人)で絞る
grant insert, update, delete on public.players               to authenticated;
grant insert, update, delete on public.games                  to authenticated;
grant insert, update, delete on public.game_batting_stats     to authenticated;
grant insert, update, delete on public.game_pitching_stats    to authenticated;
grant insert, update, delete on public.game_fielding_stats    to authenticated;
grant insert, update, delete on public.season_parameters      to authenticated;
grant insert, update, delete on public.support_stats          to authenticated;
grant insert, update, delete on public.team_schedule           to authenticated;
grant insert, update, delete on public.team_tools             to authenticated;
grant insert, update, delete on public.schedule_attendance    to authenticated;

-- ------------------------------------------------------------
-- 4. RLS 有効化
-- ------------------------------------------------------------
alter table public.players               enable row level security;
alter table public.games                  enable row level security;
alter table public.game_batting_stats     enable row level security;
alter table public.game_pitching_stats    enable row level security;
alter table public.game_fielding_stats    enable row level security;
alter table public.season_parameters      enable row level security;
alter table public.team_tools             enable row level security;
alter table public.team_schedule          enable row level security;
alter table public.schedule_attendance    enable row level security;
alter table public.support_stats          enable row level security;

-- ------------------------------------------------------------
-- 5. SELECT ポリシー
-- ------------------------------------------------------------

-- 公開読み取り（試合結果・個人成績・スケジュールは非ログインでも閲覧可）
drop policy if exists "public read" on public.players;
create policy "public read" on public.players for select using (true);

drop policy if exists "public read" on public.games;
create policy "public read" on public.games for select using (true);

drop policy if exists "public read" on public.game_batting_stats;
create policy "public read" on public.game_batting_stats for select using (true);

drop policy if exists "public read" on public.game_pitching_stats;
create policy "public read" on public.game_pitching_stats for select using (true);

drop policy if exists "public read" on public.game_fielding_stats;
create policy "public read" on public.game_fielding_stats for select using (true);

drop policy if exists "public read" on public.season_parameters;
create policy "public read" on public.season_parameters for select using (true);

drop policy if exists "public read" on public.support_stats;
create policy "public read" on public.support_stats for select using (true);

drop policy if exists "public read" on public.team_schedule;
create policy "public read" on public.team_schedule for select using (true);

-- メンバー限定読み取り（道具管理・出欠明細はログインユーザーのみ）
drop policy if exists "members read" on public.team_tools;
create policy "members read" on public.team_tools for select
  using (auth.role() = 'authenticated');

drop policy if exists "members read" on public.schedule_attendance;
create policy "members read" on public.schedule_attendance for select
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 6. 書き込みポリシー（管理者のみ）
--    試合結果・打撃/投手/守備成績・サポート成績・年度パラメータ・
--    選手マスタ・チーム道具・スケジュールは、試合後にまとめて入力する
--    管理者フォームからのみ更新される想定。
-- ------------------------------------------------------------
drop policy if exists "admin write" on public.games;
create policy "admin write" on public.games for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.game_batting_stats;
create policy "admin write" on public.game_batting_stats for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.game_pitching_stats;
create policy "admin write" on public.game_pitching_stats for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.game_fielding_stats;
create policy "admin write" on public.game_fielding_stats for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.support_stats;
create policy "admin write" on public.support_stats for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.season_parameters;
create policy "admin write" on public.season_parameters for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.team_tools;
create policy "admin write" on public.team_tools for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin write" on public.team_schedule;
create policy "admin write" on public.team_schedule for all
  using (public.is_admin()) with check (public.is_admin());

-- players: SELECT は公開ポリシーで担保済み。書き込みは管理者のみ。
drop policy if exists "admin write" on public.players;
create policy "admin write" on public.players for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 7. schedule_attendance: 本人 or 管理者が書き込み可能
--    （自分の出欠は自分で登録・変更できる。削除は管理者のみ）
-- ------------------------------------------------------------
drop policy if exists "self or admin insert attendance" on public.schedule_attendance;
create policy "self or admin insert attendance" on public.schedule_attendance for insert
  with check (
    public.is_admin() or player_id = public.current_player_id()
  );

drop policy if exists "self or admin update attendance" on public.schedule_attendance;
create policy "self or admin update attendance" on public.schedule_attendance for update
  using (
    public.is_admin() or player_id = public.current_player_id()
  )
  with check (
    public.is_admin() or player_id = public.current_player_id()
  );

drop policy if exists "admin delete attendance" on public.schedule_attendance;
create policy "admin delete attendance" on public.schedule_attendance for delete
  using (public.is_admin());

-- ============================================================
-- ここまでで RLS / 権限まわりのセットアップは完了。
-- 次に行うこと（README.md 参照）:
--   1. Authentication → Providers で Email を有効化（通常デフォルトで有効）
--   2. Authentication → Users で最初の管理者アカウントを作成
--   3. 下記テンプレートで作成したユーザーを players に紐付け、is_admin=true にする
--
--   update public.players
--   set user_id = '<Authentication > Users に表示される UUID>',
--       is_admin = true
--   where id = '<players.id、例: joe>';
-- ============================================================
