"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "./motion";

// Open sheets, innermost last: only the top one reacts to Escape and Tab.
const stack: string[] = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

/** Modal panel: slides up from the bottom on phones, floats centred on desktop. */
export function Sheet({
  open,
  onClose,
  children,
  label,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
  size?: "sm" | "lg";
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    stack.push(id);
    const returnTo = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog once it has mounted.
    const focusTimer = setTimeout(() => panel.current?.focus({ preventScroll: true }), 0);

    const onKey = (e: KeyboardEvent) => {
      if (stack.at(-1) !== id) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && panel.current) {
        // Keep Tab cycling inside the dialog.
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      if (!stack.length) document.body.style.overflow = prevOverflow;
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, id]);

  return (
    <AnimatePresence>
      {open && (
        // Small pickers open from inside bigger sheets, so they stack above them.
        <div
          className={`fixed inset-0 flex items-end justify-center sm:items-center sm:p-6 ${size === "sm" ? "z-[55]" : "z-50"}`}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={spring.soft}
            className={`bubble relative max-h-[92dvh] w-full overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] outline-none sm:rounded-b-[28px] sm:pb-0 ${
              size === "sm" ? "sm:max-w-sm" : "sm:max-w-3xl"
            }`}
          >
            {size === "lg" && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="glass absolute top-6 left-6 z-10 grid h-9 w-9 place-items-center rounded-full border border-hairline text-sm text-text sm:top-8 sm:left-8"
              >
                ✕
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
