import Link from "next/link";

import { getCurrentPlayer } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";

export default async function AuthNav() {
  const player = await getCurrentPlayer();

  if (!player) {
    return (
      <Link
        href="/login"
        className="shrink-0 rounded-md bg-team-red px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-team-red-bright"
      >
        ログイン
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3 text-sm">
      <span className="flex items-center gap-1.5">
        <span className="font-medium">{player.name}</span>
        {player.is_admin && (
          <span className="rounded-full bg-team-gold-soft px-2 py-0.5 text-xs font-semibold text-team-gold">
            管理者
          </span>
        )}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
