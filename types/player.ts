export type Player = {
  id: string;
  name: string;
  number: number | null;
  position: string | null;

  /** ログインアカウント（auth.users.id）との紐付け。未ログイン紐付けなら null */
  user_id: string | null;
  /** true の場合、試合結果・成績・スケジュール等の登録/編集が可能 */
  is_admin: boolean;
  /** true の場合は自チームの選手ではなく助っ人。個人成績(/stats)には表示しない */
  is_guest: boolean;

  created_at: string;
};
