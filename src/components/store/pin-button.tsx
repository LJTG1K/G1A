"use client";

import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/components/ui/motion";

/** Pin toggle with a springy "pop" and a burst ring when pinned. */
export function PinButton({
  pinned,
  onToggle,
  size = "md",
}: {
  pinned: boolean;
  onToggle: () => void;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={{ scale: 0.8 }}
      transition={spring.bouncy}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin" : "Pin"}
      className={`glass relative grid ${dim} shrink-0 place-items-center rounded-full border border-hairline ${
        pinned ? "text-accent" : "text-text"
      }`}
    >
      <AnimatePresence>
        {pinned && (
          <motion.span
            key="burst"
            className="absolute inset-0 rounded-full border-2 border-accent"
            initial={{ scale: 0.6, opacity: 1 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      <motion.svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        animate={pinned ? { scale: [1, 1.35, 1], rotate: [0, -15, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.4 }}
        aria-hidden
      >
        <path
          d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5M8 11l5 5"
          className={pinned ? "fill-current" : "fill-none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.button>
  );
}
