"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "./motion";

type Theme = "system" | "light" | "dark";
const KEY = "g1a-theme";
const order: Theme[] = ["system", "light", "dark"];

/** Runs before first paint (see layout) so the stored theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
function write(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => "system" as Theme,
  );
  const next = order[(order.indexOf(theme) + 1) % order.length];

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      transition={spring.snappy}
      onClick={() => write(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
      className="grid h-9 w-9 place-items-center rounded-full text-text hover:bg-hairline"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={spring.snappy}
        >
          {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <AutoIcon />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

const icon = "h-[18px] w-[18px] fill-none stroke-current stroke-[1.8]";
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" className="fill-current" />
    </svg>
  );
}
