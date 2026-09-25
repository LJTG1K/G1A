"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";

// Visual placeholder for M1; wired to real categories and search in M4.
const categories = ["All", "Tops", "Hoodies", "Outerwear", "Pants", "Shorts", "Footwear", "Accessories"];

export function StoreFilters() {
  const [active, setActive] = useState("All");
  return (
    <div className="mb-6 space-y-4">
      <input type="search" placeholder="Search every sheet" className="field max-w-md" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {categories.map((c) => (
          <Chip key={c} group="category" active={active === c} onClick={() => setActive(c)}>
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}
