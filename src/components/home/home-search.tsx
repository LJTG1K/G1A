"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Homepage search: opens All products with the query filled in. */
export function HomeSearch({ total }: { total: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        router.push(text ? `/store?q=${encodeURIComponent(text)}` : "/store");
      }}
      className="relative mt-6 max-w-xl"
    >
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 fill-none stroke-current stroke-2 text-muted"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${total.toLocaleString()} products across every sheet`}
        aria-label="Search all products"
        className="field rounded-full py-3.5 pr-28 pl-11"
      />
      <button
        type="submit"
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:brightness-110"
      >
        Search
      </button>
    </form>
  );
}
