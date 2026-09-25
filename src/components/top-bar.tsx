import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "./nav-links";

export async function TopBar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  return (
    <header className="glass sticky top-0 z-40 border-b border-hairline">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          G1A
        </Link>
        <NavLinks signedIn={!!email} />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {email ? (
            <form action={signOut}>
              <button
                type="submit"
                title={email}
                className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-hairline hover:text-text"
              >
                Sign out
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
