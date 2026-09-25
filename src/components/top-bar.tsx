import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "./nav-links";

export async function TopBar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const admin = await isAdmin(supabase, (data?.claims?.sub as string | undefined) ?? null);

  return (
    <header className="glass sticky top-0 z-40 border-b border-hairline pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          G1A
        </Link>
        <NavLinks signedIn={!!email} admin={admin} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {email ? (
            <form action={signOut}>
              <button
                type="submit"
                title={`Sign out (${email})`}
                aria-label="Sign out"
                className="grid h-9 min-w-9 place-items-center whitespace-nowrap rounded-full text-sm text-muted transition-colors hover:bg-hairline hover:text-text sm:px-3"
              >
                <span className="hidden sm:inline">Sign out</span>
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.8] sm:hidden" aria-hidden>
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-contrast transition hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
