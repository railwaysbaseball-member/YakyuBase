-- ============================================================
-- 0008_required_pa_numeric.sql
-- season_parameters.required_pa を integer から numeric に変更
--
-- 背景: required_pa は「試合数 × この倍率を切り上げ」で規定打席数を
-- 算出するための倍率であり、requiredIpと同様に小数（例: 1.5）を
-- 設定できる必要がある。しかし required_pa は integer 型で定義されて
-- いたため、1.5 のような小数を保存しようとすると
-- "invalid input syntax for type integer" で失敗していた。
-- required_ip は元々 numeric 型なので、それに合わせる。
--
-- 実行方法: 0001〜0007と同様、Supabase ダッシュボードの SQL Editor に
-- 貼り付けて実行。
-- ============================================================

alter table public.season_parameters
  alter column required_pa type numeric using required_pa::numeric;
