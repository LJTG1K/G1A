"use client";

import { useEffect } from "react";

/** Registers /sw.js in production (dev stays uncached so edits always show). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
      console.error("Service worker registration failed", e);
    });
  }, []);
  return null;
}
