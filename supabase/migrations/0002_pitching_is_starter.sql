-- ============================================================
-- 0002_pitching_is_starter.sql
-- game_pitching_stats に先発投手フラグを追加
--
-- 背景: 既存データには「誰が先発したか」を示す列が無く、created_at も
-- バルクインサート時に同一タイムスタンプになるため登板順から先発を
-- 推測できない。QS（クオリティスタート）判定に必須のため明示列を追加する。
--
-- 実行方法: 0001_auth_setup.sql と同様、Supabase ダッシュボードの
-- SQL Editor に貼り付けて実行。
-- ============================================================

alter table public.game_pitching_stats
  add column if not exists is_starter boolean not null default false;

-- 参考: 既存データを暫定的に補正したい場合、各試合で最初に登板した投手を
-- 先発とみなすなら以下のようなクエリで一括更新できる（created_at が同一の
-- 試合では不正確になりうるので、目視確認の上で実行すること）。
--
-- with ranked as (
--   select id,
--          row_number() over (
--            partition by game_id
--            order by created_at asc, id asc
--          ) as rn
--   from public.game_pitching_stats
-- )
-- update public.game_pitching_stats gps
-- set is_starter = true
-- from ranked
-- where gps.id = ranked.id and ranked.rn = 1;
