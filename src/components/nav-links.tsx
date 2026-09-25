"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { spring } from "@/components/ui/motion";

const links = [
  { href: "/", label: "Store", auth: false },
  { href: "/sources", label: "Sheets", auth: true },
  { href: "/boards", label: "Boards", auth: true },
];

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {links
        .filter((l) => signedIn || !l.auth)
        .map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative rounded-full px-3 py-1.5 text-sm transition-colors ${
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
            </Link>
          );
        })}
    </nav>
  );
}
