import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import AuthNav from "@/components/AuthNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "レールウェイズ 成績管理",
  description: "草野球チーム「レールウェイズ」の成績管理ツール",
};

const NAV_LINKS = [
  { href: "/", label: "TOP" },
  { href: "/games", label: "試合結果" },
  { href: "/stats", label: "個人成績" },
  { href: "/schedule", label: "スケジュール" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="h-1 bg-gradient-to-r from-team-red via-team-red-bright to-team-gold" />
        <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-team-red text-sm font-black text-white">
                R
              </span>
              <span className="text-base font-black tracking-tight">
                レールウェイズ
              </span>
            </Link>

            <nav className="hidden flex-1 items-center gap-1 sm:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Suspense fallback={null}>
              <AuthNav />
            </Suspense>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto border-t border-border-subtle px-4 py-1.5 sm:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-md px-3 py-1 text-sm font-medium text-foreground/70 hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        <footer className="border-t border-border-subtle px-4 py-6 text-center text-xs text-foreground/50">
          © 1995-{new Date().getFullYear()} レールウェイズ
        </footer>
      </body>
    </html>
  );
}
