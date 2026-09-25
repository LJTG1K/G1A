"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Friendly fallback for unexpected errors in any page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="bubble max-w-sm p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-muted">That didn’t load properly. Try again, or head back to the store.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Ref {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110"
          >
            Try again
          </button>
          <Link href="/" className="rounded-full px-5 py-2.5 text-sm font-medium text-accent hover:bg-hairline">
            Store
          </Link>
        </div>
      </div>
    </main>
  );
}
