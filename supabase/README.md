# Supabase セットアップ手順

## マイグレーションの適用

1. Supabase ダッシュボード → 対象プロジェクト → **SQL Editor** を開く
2. `migrations/0001_auth_setup.sql` の中身を全文コピーして貼り付け、実行（Run）
3. エラーが出ずに完了すればOK。既存データは変更されない（`players` にカラムが2つ増えるだけ）

このSQLで行っていること:

- `players` に `user_id`（ログインアカウントとの紐付け）と `is_admin`（管理者フラグ）を追加
- 全テーブルで RLS（Row Level Security）を有効化
- 試合結果・個人成績・スケジュールは**非ログインでも閲覧可**（現行サイトと同じ）
- 道具管理・出欠明細は**ログインユーザーのみ閲覧可**
- 書き込み（試合結果・成績登録など）は**管理者（is_admin = true）のみ**
- 出欠登録は**本人 or 管理者**のみ

## Email認証の有効化

Authentication → Providers → **Email** が有効になっているか確認（新規プロジェクトはデフォルトで有効）。
「Confirm email」を無効にしておくと、招待したメンバーがすぐログインできて運用が楽です（チーム内限定ツールのため、メール確認は必須ではない想定）。

## 最初の管理者アカウントを作る

1. Authentication → Users → **Add user** で、管理者にしたい人のメールアドレス・パスワードを設定してユーザーを作成
2. 作成されたユーザーの一覧に表示される **UUID** をコピー
3. SQL Editor で以下を実行し、既存の `players` レコードと紐付ける

```sql
update public.players
set user_id = '<コピーしたUUID>',
    is_admin = true
where id = '<players.id。例: joe>';
```

`players.id` は現状「選手名がそのままID」になっている（例: `joe`, `石ちゃん`）。対象者の行は `select id, name from public.players order by name;` で確認できる。

## 以降のメンバー追加

同じ要領で、Authentication → Users でアカウントを作り、`players.user_id` を埋めるだけでログイン可能になる。`is_admin` は入力権限を持たせたい人だけ `true` にする（一般メンバーは `false` のままでOK — ログインすれば道具管理・出欠登録は使えるが、試合結果や成績の登録はできない）。

## 注意

- **service_role キーはこのリポジトリに置かない。** anon キー（`.env.local` の `NEXT_PUBLIC_SUPABASE_ANON_KEY`）のみで運用する設計になっている
- DDL（テーブル追加・カラム変更・RLSポリシー変更）は今後もこの `migrations/` にSQLファイルを追加し、SQL Editorで手動実行する運用とする
