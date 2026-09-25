"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { riseIn, spring, staggerGrid } from "@/components/ui/motion";
import { refreshTab, removeTab } from "./actions";

export type SourceItem = {
  id: string;
  tabName: string;
  sheetTitle: string | null;
  sheetUrl: string;
  featured: boolean;
  products: number;
  fetchedAt: string | null;
};

function ago(iso: string | null) {
  if (!iso) return "not fetched yet";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "updated just now";
  if (min < 60) return `updated ${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `updated ${h} h ago` : `updated ${Math.round(h / 24)} d ago`;
}

export function SourceList({ items }: { items: SourceItem[] }) {
  return (
    <motion.ul variants={staggerGrid} initial="hidden" animate="show" className="space-y-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <SourceRow key={item.id} item={item} />
        ))}
      </AnimatePresence>
      {items.every((i) => i.featured) && (
        <motion.li variants={riseIn} className="rounded-[28px] border border-dashed border-hairline p-8 text-center text-muted">
          You haven’t added any sheets yet.{" "}
          <Link href="/sources/new" className="text-accent hover:underline">
            Add your first one
          </Link>
          .
        </motion.li>
      )}
    </motion.ul>
  );
}

function SourceRow({ item }: { item: SourceItem }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"refresh" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = (kind: "refresh" | "remove") => {
    setBusy(kind);
    setMessage(null);
    start(async () => {
      if (kind === "refresh") {
        const res = await refreshTab(item.id);
        setMessage(res.ok ? `Refreshed · ${res.count.toLocaleString()} products` : res.error);
      } else {
        const res = await removeTab(item.id);
        if (!res.ok) setMessage(res.error);
      }
      setBusy(null);
      setConfirming(false);
    });
  };

  return (
    <motion.li
      layout
      variants={riseIn}
      exit={{ opacity: 0, scale: 0.96, height: 0, marginTop: 0 }}
      transition={spring.soft}
      className="bubble flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold">{item.tabName}</h2>
          {item.featured && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">Featured</span>
          )}
        </div>
        <p className="truncate text-sm text-muted">
          {item.sheetTitle ?? "Google Sheet"} · {item.products.toLocaleString()} products · {ago(item.fetchedAt)}
        </p>
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1 text-sm text-accent"
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <a
          href={item.sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hairline hover:text-text"
        >
          Open sheet
        </a>
        {!item.featured && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("refresh")}
              className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hairline hover:text-text disabled:opacity-50"
            >
              <motion.span
                className="inline-block"
                animate={busy === "refresh" ? { rotate: 360 } : { rotate: 0 }}
                transition={busy === "refresh" ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
              >
                ↻
              </motion.span>{" "}
              Refresh
            </button>
            <Link
              href={`/sources/new?url=${encodeURIComponent(item.sheetUrl)}`}
              className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hairline hover:text-text"
            >
              Edit mapping
            </Link>
            {confirming ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run("remove")}
                className="rounded-full bg-danger px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === "remove" ? "Removing…" : "Confirm remove"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hairline hover:text-danger"
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </motion.li>
  );
}
