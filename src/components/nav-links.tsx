"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { usePins } from "@/components/pins/pins-provider";
import { spring } from "@/components/ui/motion";

const links = [
  { href: "/", label: "Store", auth: false },
  { href: "/sources", label: "Sheets", auth: true },
  { href: "/boards", label: "Boards", auth: true },
  { href: "/admin", label: "Admin", auth: true, admin: true },
];

export function NavLinks({ signedIn, admin = false }: { signedIn: boolean; admin?: boolean }) {
  const pathname = usePathname();
  const { pinCount } = usePins();
  // Scrolls sideways on narrow phones instead of pushing the top bar wider.
  return (
    <nav className="-my-2 flex min-w-0 items-center gap-0.5 overflow-x-auto py-2 [scrollbar-width:none] sm:gap-1">
      {links
        .filter((l) => (signedIn || !l.auth) && (admin || !("admin" in l)))
        .map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                active ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  transition={spring.snappy}
                  className="absolute inset-0 rounded-full bg-hairline"
                />
              )}
              <span className="relative">{l.label}</span>
              {l.href === "/boards" && pinCount > 0 && (
                // Re-keyed on count so it bounces each time a pin is added or removed.
                <motion.span
                  key={pinCount}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={spring.bouncy}
                  className="relative ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-contrast"
                >
                  {pinCount}
                </motion.span>
              )}
            </Link>
          );
        })}
    </nav>
  );
}
