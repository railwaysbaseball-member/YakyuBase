-- ============================================================
-- 0007_schedule_attendance_unique.sql
-- schedule_attendance に (schedule_id, player_id) の一意制約を追加
--
-- 背景: setAttendance() はこれまで「select→無ければinsert、あればupdate」
-- という2ステップの実装だったため、同じ選手が同じスケジュールに対して
-- ほぼ同時に2回送信した場合（ダブルクリック、複数タブでの操作など）に
-- 重複行が作られてしまう可能性があった（実害は未確認）。重複行が残ると
-- /schedule/rate の参加率集計が二重カウントされる。一意制約を追加した
-- 上で setAttendance() を upsert 1回に変更し、構造的に重複を作れなく
-- する。
--
-- 実行方法: 0001〜0006と同様、Supabase ダッシュボードの SQL Editor に
-- 貼り付けて実行。
-- ============================================================

-- 制約追加の前に、既存の重複行があれば新しい方だけ残して削除する
-- （重複が無ければ何も削除されない安全な操作）。
delete from public.schedule_attendance a
using public.schedule_attendance b
where a.schedule_id = b.schedule_id
  and a.player_id = b.player_id
  and a.created_at < b.created_at;

alter table public.schedule_attendance
  add constraint schedule_attendance_schedule_id_player_id_key
  unique (schedule_id, player_id);
