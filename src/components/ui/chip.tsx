"use client";

import { motion } from "motion/react";
import { spring } from "./motion";

/** Toggleable filter chip. Chips sharing a `group` slide one highlight between them. */
export function Chip({
  active,
  onClick,
  children,
  group,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  group?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={spring.snappy}
      aria-pressed={active}
      className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active ? "text-accent-contrast" : "bg-surface text-text border border-hairline hover:bg-surface-2"
      }`}
    >
      {active && (
        <motion.span
          layoutId={group ? `chip-${group}` : undefined}
          transition={spring.snappy}
          className="absolute inset-0 rounded-full bg-accent"
        />
      )}
      <span className="relative">{children}</span>
    </motion.button>
  );
}
