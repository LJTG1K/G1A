"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { spring } from "./motion";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:brightness-110",
  secondary: "bg-surface-2 text-text border border-hairline hover:bg-hairline",
  ghost: "text-accent hover:bg-hairline",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: HTMLMotionProps<"button"> & { variant?: Variant }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring.snappy}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-[filter,background-color] disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
