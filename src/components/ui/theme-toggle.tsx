"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "./motion";

type Theme = "light" | "dark";
const KEY = "g1a-theme";

/** Runs before first paint (see layout) so the stored theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The theme actually showing: the saved choice, else the device setting. */
function read(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return media().matches ? "dark" : "light";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Follow the device setting live until the user picks a theme.
  const m = media();
  m.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    m.removeEventListener("change", cb);
  };
}

function apply(t: Theme) {
  const root = document.documentElement;
  // Switch in one repaint: pause every CSS transition for this frame so hundreds of
  // cards don't each fade their colours separately.
  root.classList.add("theme-switching");
  root.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  listeners.forEach((l) => l());
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      transition={spring.snappy}
      onClick={() => apply(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full text-text hover:bg-hairline"
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={theme}
          className="absolute"
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={spring.snappy}
        >
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
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
