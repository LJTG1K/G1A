"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { spring } from "@/components/ui/motion";
import { usePins } from "@/components/pins/pins-provider";
import {
  addKeyword,
  deletePreset,
  deleteSharedTag,
  reapplyKeywords,
  removeKeyword,
  setPresetApproved,
  setTagApproved,
} from "./actions";

type Keyword = { id: number; category: string; keyword: string };
export type PresetRow = {
  sourceId: string;
  signature: string;
  tab: string;
  sheet: string;
  featured: boolean;
  summary: string;
  votes: number;
  approved: boolean;
};
export type TagRow = {
  itemKey: string;
  name: string;
  category: string;
  rawCategory: string;
  votes: number;
  approved: boolean;
};

const TABS = ["Keywords", "Mapping presets", "Shared categories"] as const;

export function AdminPanel({ keywords, presets, tags }: { keywords: Keyword[]; presets: PresetRow[]; tags: TagRow[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Keywords");
  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Chip key={t} group="admin-tab" active={tab === t} onClick={() => setTab(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          {tab === "Keywords" && <Keywords initial={keywords} />}
          {tab === "Mapping presets" && <Presets initial={presets} />}
          {tab === "Shared categories" && <Tags initial={tags} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Keywords ─────────────────────────────────────────────────────────

function Keywords({ initial }: { initial: Keyword[] }) {
  const { toast } = usePins();
  const [rows, setRows] = useState(initial);
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const map = new Map<string, Keyword[]>();
    for (const k of rows) {
      if (f && !k.keyword.includes(f) && !k.category.toLowerCase().includes(f)) continue;
      map.set(k.category, [...(map.get(k.category) ?? []), k]);
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, filter]);
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);

  const report = (changed: number) =>
    toast({ message: changed ? `Re-categorised ${changed.toLocaleString()} listings` : "No listings changed category" });

  const add = () =>
    start(async () => {
      const res = await addKeyword(category, keyword);
      if (!res.ok) return toast({ message: res.error });
      setRows((r) => [...r, { id: res.id, category: category.trim(), keyword: keyword.trim().toLowerCase() }]);
      setKeyword("");
      report(res.changed);
    });

  const remove = (k: Keyword) =>
    start(async () => {
      setRows((r) => r.filter((x) => x.id !== k.id));
      const res = await removeKeyword(k.id);
      if (!res.ok) {
        setRows((r) => [...r, k]);
        return toast({ message: res.error });
      }
      report(res.changed);
    });

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="bubble flex flex-wrap items-center gap-2 p-4"
      >
        <input
          list="admin-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Outerwear)"
          aria-label="Category"
          className="field max-w-56 py-2.5 text-sm"
        />
        <datalist id="admin-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword in product names (e.g. windbreaker)"
          aria-label="Keyword"
          className="field min-w-48 flex-1 py-2.5 text-sm"
        />
        <Button type="submit" disabled={pending || !category.trim() || !keyword.trim()}>
          {pending ? "Working…" : "Add keyword"}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keywords"
          aria-label="Filter keywords"
          className="field max-w-xs py-2 text-sm"
        />
        <span className="text-sm text-muted">
          {rows.length} keywords · {categories.length} categories
        </span>
        <Button
          variant="ghost"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await reapplyKeywords();
              if (!res.ok) toast({ message: res.error });
              else report(res.changed);
            })
          }
        >
          Re-apply keywords
        </Button>
      </div>

      <p className="text-sm text-muted">
        Product names are matched on whole words (plurals too). When several keywords match, the one nearest the end
        of the name wins — “zip up jacket” → jacket.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {grouped.map(([cat, list]) => (
          <div key={cat} className="bubble p-4">
            <h3 className="font-semibold">{cat}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {list.map((k) => (
                  <motion.span
                    key={k.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={spring.snappy}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm"
                  >
                    {k.keyword}
                    <button
                      type="button"
                      onClick={() => remove(k)}
                      disabled={pending}
                      aria-label={`Remove ${k.keyword}`}
                      className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-hairline hover:text-danger"
                    >
                      ×
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Presets ──────────────────────────────────────────────────────────

function Status({ approved, live }: { approved: boolean; live: boolean }) {
  const [label, cls] = approved
    ? ["Approved", "bg-success/15 text-success"]
    : live
      ? ["Shared", "bg-accent/15 text-accent"]
      : ["Pending", "bg-hairline text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function Presets({ initial }: { initial: PresetRow[] }) {
  const { toast } = usePins();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();

  const approve = (p: PresetRow, approved: boolean) =>
    start(async () => {
      const res = await setPresetApproved(p.sourceId, p.signature, approved);
      if (!res.ok) return toast({ message: res.error });
      setRows((all) =>
        all.map((r) =>
          r.sourceId !== p.sourceId ? r : { ...r, approved: r.signature === p.signature ? approved : approved ? false : r.approved },
        ),
      );
    });

  const remove = (p: PresetRow) =>
    start(async () => {
      const res = await deletePreset(p.sourceId, p.signature);
      if (!res.ok) return toast({ message: res.error });
      setRows((all) => all.filter((r) => !(r.sourceId === p.sourceId && r.signature === p.signature)));
    });

  if (!rows.length) return <Empty text="No mapping presets yet. They appear as users map sheets." />;
  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false}>
        {rows.map((p) => (
          <motion.li
            key={`${p.sourceId}-${p.signature}`}
            layout
            exit={{ opacity: 0, height: 0 }}
            className="bubble flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.tab}</span>
                <span className="truncate text-sm text-muted">{p.sheet}</span>
                {p.featured && <span className="text-xs text-accent">Featured</span>}
                <Status approved={p.approved} live={p.votes >= 3} />
              </div>
              <p className="mt-1 text-sm text-muted">{p.summary}</p>
              <p className="mt-0.5 text-xs text-muted">
                {p.votes} {p.votes === 1 ? "user" : "users"} mapped it this way
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant={p.approved ? "secondary" : "primary"} disabled={pending} onClick={() => approve(p, !p.approved)}>
                {p.approved ? "Unapprove" : "Approve"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => remove(p)}>
                Delete
              </Button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

// ─── Shared tags ──────────────────────────────────────────────────────

function Tags({ initial }: { initial: TagRow[] }) {
  const { toast } = usePins();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();

  const approve = (t: TagRow, approved: boolean) =>
    start(async () => {
      const res = await setTagApproved(t.itemKey, t.rawCategory, approved);
      if (!res.ok) return toast({ message: res.error });
      setRows((all) =>
        all.map((r) =>
          r.itemKey !== t.itemKey ? r : { ...r, approved: r.rawCategory === t.rawCategory ? approved : approved ? false : r.approved },
        ),
      );
    });

  const remove = (t: TagRow) =>
    start(async () => {
      const res = await deleteSharedTag(t.itemKey, t.rawCategory);
      if (!res.ok) return toast({ message: res.error });
      setRows((all) => all.filter((r) => !(r.itemKey === t.itemKey && r.rawCategory === t.rawCategory)));
    });

  if (!rows.length) return <Empty text="No shared categories yet. They appear when users re-file products." />;
  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false}>
        {rows.map((t) => (
          <motion.li
            key={`${t.itemKey}-${t.rawCategory}`}
            layout
            exit={{ opacity: 0, height: 0 }}
            className="bubble flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{t.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>
                  → <span className="font-medium text-text">{t.category}</span>
                </span>
                <span>
                  · {t.votes} {t.votes === 1 ? "vote" : "votes"}
                </span>
                <Status approved={t.approved} live={t.votes >= 3} />
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant={t.approved ? "secondary" : "primary"} disabled={pending} onClick={() => approve(t, !t.approved)}>
                {t.approved ? "Unapprove" : "Approve"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => remove(t)}>
                Delete
              </Button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="bubble p-8 text-center text-muted">{text}</p>;
}
