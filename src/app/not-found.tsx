import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="bubble max-w-sm p-8 text-center">
        <p className="text-5xl font-semibold tracking-tight text-muted">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted">That page doesn’t exist, or it isn’t yours to see.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110"
        >
          Back to the store
        </Link>
      </div>
    </main>
  );
}
