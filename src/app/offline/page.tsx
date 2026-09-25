import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker when a page can't be reached. */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="bubble max-w-sm p-8 text-center">
        <p className="text-4xl" aria-hidden>
          ☁︎
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">You’re offline</h1>
        <p className="mt-2 text-muted">G1A needs a connection to load the latest from your sheets. Check your connection and try again.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the retry */}
        <a
          href="/"
          className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
