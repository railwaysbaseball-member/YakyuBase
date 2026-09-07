export type Player = {
  id: string;
  name: string;
  number: number | null;
  position: string | null;

  /** ログインアカウント（auth.users.id）との紐付け。未ログイン紐付けなら null */
  user_id: string | null;
  /** true の場合、試合結果・成績・スケジュール等の登録/編集が可能 */
  is_admin: boolean;

  created_at: string;
};
