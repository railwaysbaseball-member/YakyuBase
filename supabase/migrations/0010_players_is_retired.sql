-- ============================================================
-- 0010_players_is_retired.sql
-- players に「退会済み」フラグを追加
--
-- 背景: これまで is_guest（助っ人）で「自チームの選手として個人成績・
-- 出欠管理に含めるか」を区別していたが、「元は自チームの選手だったが
-- 退会した」ケースはどちらにも当てはまらない。退会済みの選手は
--   - 出欠管理・スケジュールの未回答判定など「現役メンバー」を対象とする
--     箇所では助っ人と同様に除外する
--   - 個人成績(/stats)には引き続き表示する（在籍中に残した成績のため）
-- という助っ人とは異なる扱いになる。
--
-- is_guest と is_retired はどちらも自チームの現役選手ではないことを表す
-- ため、同時に true になることは想定しない（アプリ側のUIで排他的に
-- 切り替える）。
--
-- 実行方法: 0001〜0009と同様、Supabase ダッシュボードの SQL Editor に
-- 貼り付けて実行。
-- ============================================================

alter table public.players
  add column if not exists is_retired boolean not null default false;

alter table public.players
  drop constraint if exists players_not_guest_and_retired;

alter table public.players
  add constraint players_not_guest_and_retired check (not (is_guest and is_retired));
