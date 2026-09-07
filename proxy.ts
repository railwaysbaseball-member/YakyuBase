import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * このNext.jsフォーク（16系）では `middleware.ts` は廃止され `proxy.ts` に
 * 名称変更されている。挙動は旧middlewareと同じ。
 *
 * ここでやること:
 *   1. すべてのリクエストでSupabaseセッションを更新する（トークンリフレッシュ）
 *   2. メンバー限定ページ（道具管理・所属選手・チーム記録・チーム分析）を
 *      未ログインユーザーから守り、/login へリダイレクトする
 *
 * 実際のデータアクセス制御は Supabase の RLS（supabase/migrations 参照）が
 * 最終防衛線。ここでのリダイレクトはUX向上のための一次チェックに過ぎない。
 */

const MEMBER_ONLY_PREFIXES = [
  "/tools",
  "/members",
  "/team-records",
  "/team-analysis",
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // createServerClient と getUser の間に他のロジックを挟まないこと
  // (Supabase公式の注意事項: セッションリフレッシュのタイミングがずれるため)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isMemberOnly = MEMBER_ONLY_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isMemberOnly && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
