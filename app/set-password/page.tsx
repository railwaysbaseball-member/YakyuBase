"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";

export default function SetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // 招待メールのリンクを開くと、URLのフラグメント(#access_token=...)から
    // supabase-js が自動でセッションを確立する。少し時間がかかることがあるため
    // getSession() で確認する。
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        setError(
          "リンクが無効か期限切れです。もう一度招待メールを送ってもらってください。"
        );
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setError(`設定に失敗しました: ${error.message}`);
      return;
    }
    setDone(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-bold">パスワード設定</h1>
        <p className="mt-1 text-sm text-foreground/60">
          招待メールのリンクから開いた場合、ここで新しいパスワードを設定できます。
        </p>
      </div>

      {done ? (
        <p className="text-sm">
          パスワードを設定しました。
          <Link href="/login" className="ml-1 underline">
            ログインページへ
          </Link>
        </p>
      ) : ready ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              新しいパスワード
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm" className="text-sm font-medium">
              新しいパスワード（確認）
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red"
            />
          </div>

          {error && <p className="text-sm text-loss">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50"
          >
            {pending ? "設定中..." : "パスワードを設定"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-loss">{error ?? "確認中..."}</p>
      )}
    </div>
  );
}
