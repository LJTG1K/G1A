import type { Transition, Variants } from "motion/react";

/** Shared spring presets so every animation in the app feels the same. */
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 32 } satisfies Transition,
  soft: { type: "spring", stiffness: 260, damping: 26 } satisfies Transition,
  bouncy: { type: "spring", stiffness: 600, damping: 15 } satisfies Transition,
};

export const staggerGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring.soft },
};
