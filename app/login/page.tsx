import LoginForm from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const nextParam = searchParams?.next;
  const next = typeof nextParam === "string" ? nextParam : "/";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-xl font-bold">ログイン</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          メンバー限定ページ・成績入力にはログインが必要です。
        </p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
