"use client";

import { useEffect, useRef, useState } from "react";
import { refreshStore } from "@/app/store-actions";

const REFRESH_KEY = "g1a-store-checked";
const REFRESH_EVERY_MS = 10 * 60 * 1000;

export type RefreshStatus = "idle" | "checking" | "updated";

/**
 * On open, re-reads sheets that haven't been checked in 10 minutes (at most once
 * per 10 minutes per browser tab) and calls onChanged if any products changed.
 */
export function useSheetRefresh(demo: boolean, onChanged: () => void): RefreshStatus {
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const changed = useRef(onChanged);
  useEffect(() => {
    changed.current = onChanged;
  });

  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(REFRESH_KEY)) || 0;
    } catch {}
    if (Date.now() - last < REFRESH_EVERY_MS) return;
    // Start after first paint so the page shows immediately.
    const start = setTimeout(async () => {
      setStatus("checking");
      const didChange = await refreshStore(demo).catch(() => false);
      try {
        sessionStorage.setItem(REFRESH_KEY, String(Date.now()));
      } catch {}
      if (!didChange) return setStatus("idle");
      setStatus("updated");
      changed.current();
      setTimeout(() => setStatus("idle"), 2500);
    }, 300);
    return () => clearTimeout(start);
  }, [demo]);

  return status;
}
