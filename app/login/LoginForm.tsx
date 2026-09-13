"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "@/lib/auth/actions";

type PlayerOption = { id: string; name: string; number: number | null };

export default function LoginForm({
  next,
  players,
}: {
  next: string;
  players: PlayerOption[];
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signIn,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1">
        <label htmlFor="playerId" className="text-sm font-medium">
          選手
        </label>
        <select
          id="playerId"
          name="playerId"
          required
          defaultValue=""
          className="rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red"
        >
          <option value="" disabled>
            選択してください
          </option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number != null ? `${p.number} ` : ""}
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-team-red"
        />
      </div>

      {state?.error && <p className="text-sm text-loss">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-team-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright disabled:opacity-50"
      >
        {pending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
