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
  /** true の場合は退会済み。出欠管理等の現役メンバー対象からは除外するが、
   *  個人成績(/stats)には在籍中の成績として引き続き表示する */
  is_retired: boolean;

  created_at: string;
};
