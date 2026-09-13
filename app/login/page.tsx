import { supabase } from "@/utils/supabaseClient";
import { fetchAllRows } from "@/utils/supabaseFetchAll";
import LoginForm from "./LoginForm";

type PlayerOption = { id: string; name: string; number: number | null; user_id: string | null };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const nextParam = searchParams?.next;
  const next = typeof nextParam === "string" ? nextParam : "/";

  const { data: players } = await fetchAllRows<PlayerOption>((from, to) =>
    supabase.from("players").select("id, name, number, user_id").range(from, to)
  );

  // ログインアカウントが紐付いている選手だけを選択肢にする。
  const loginablePlayers = (players ?? [])
    .filter((p) => p.user_id != null)
    .sort((a, b) => {
      if (a.number == null && b.number == null) return a.name.localeCompare(b.name);
      if (a.number == null) return 1;
      if (b.number == null) return -1;
      return a.number - b.number;
    });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-bold">ログイン</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          メンバー限定ページ・成績入力にはログインが必要です。
        </p>
      </div>
      <LoginForm next={next} players={loginablePlayers} />
    </div>
  );
}
