"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { spring } from "@/components/ui/motion";
import type { Mapping } from "@/server/sheets/types";
import { inspectSheet, previewTab, saveTab, type InspectResult, type PreviewResult } from "../actions";
import { MappingEditor } from "./mapping-editor";

type Sheet = Extract<InspectResult, { ok: true }>;
type Preview = Extract<PreviewResult, { ok: true }>;
type Step =
  | { kind: "link" }
  | { kind: "tabs"; sheet: Sheet }
  | { kind: "map"; sheet: Sheet; queue: Sheet["tabs"]; index: number; preview: Preview | null; saved: Saved }
  | { kind: "done"; sheet: Sheet; tabs: number; products: number };

/** Running totals across the tabs saved so far. */
type Saved = { tabs: number; products: number };
const NONE: Saved = { tabs: 0, products: 0 };

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: spring.soft,
};

export function AddSheetWizard({ initialUrl }: { initialUrl?: string }) {
  const [step, setStep] = useState<Step>({ kind: "link" });
  const [url, setUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const autoStarted = useRef(false);

  function submitLink(link = url) {
    setError(null);
    start(async () => {
      const res = await inspectSheet(link);
      if (!res.ok) return setError(res.error);
      setSelected(new Set(res.preselect && res.tabs.some((t) => t.gid === res.preselect) ? [res.preselect] : []));
      setStep({ kind: "tabs", sheet: res });
    });
  }

  // "Edit mapping" links arrive with ?url=…; start straight away.
  useEffect(() => {
    if (initialUrl && !autoStarted.current) {
      autoStarted.current = true;
      submitLink(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  function loadTab(sheet: Sheet, queue: Sheet["tabs"], index: number, saved: Saved) {
    setError(null);
    setStep({ kind: "map", sheet, queue, index, preview: null, saved });
    start(async () => {
      const res = await previewTab(sheet.sheetId, queue[index], sheet.title);
      if (!res.ok) return setError(res.error);
      setStep({ kind: "map", sheet, queue, index, preview: res, saved });
    });
  }

  function save(mapping: Mapping) {
    if (step.kind !== "map" || !step.preview) return;
    const { preview, saved } = step;
    setError(null);
    start(async () => {
      const res = await saveTab(preview.sourceId, mapping);
      if (!res.ok) return setError(res.error);
      advance({ tabs: saved.tabs + 1, products: saved.products + res.count });
    });
  }

  /** Next tab in the queue, or the summary when all are done. */
  function advance(saved: Saved) {
    if (step.kind !== "map") return;
    const { sheet, queue, index } = step;
    if (index + 1 < queue.length) loadTab(sheet, queue, index + 1, saved);
    else if (saved.tabs === 0) setStep({ kind: "tabs", sheet });
    else setStep({ kind: "done", sheet, tabs: saved.tabs, products: saved.products });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Progress step={step} />

      <AnimatePresence mode="wait">
        {step.kind === "link" && (
          <motion.form
            key="link"
            {...slide}
            onSubmit={(e) => {
              e.preventDefault();
              submitLink();
            }}
            className="bubble space-y-4 p-6 sm:p-8"
          >
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Paste a spreadsheet link</h2>
              <p className="mt-1 text-sm text-muted">Any public Google Sheet (“Anyone with the link can view”).</p>
            </div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="field"
              autoFocus
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !url.trim()}>
                {pending ? "Reading sheet…" : "Continue"}
              </Button>
            </div>
          </motion.form>
        )}

        {step.kind === "tabs" && (
          <motion.div key="tabs" {...slide} className="bubble space-y-5 p-6 sm:p-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{step.sheet.title ?? "Choose tabs"}</h2>
              <p className="mt-1 text-sm text-muted">Tick the tabs that list products. You’ll map each one next.</p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {step.sheet.tabs.map((t) => {
                const on = selected.has(t.gid);
                return (
                  <li key={t.gid}>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(t.gid)) next.delete(t.gid);
                          else next.add(t.gid);
                          return next;
                        })
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                        on ? "border-accent bg-accent/10" : "border-hairline bg-surface-2 hover:bg-hairline"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-md border text-[12px] transition-colors ${
                          on ? "border-accent bg-accent text-accent-contrast" : "border-hairline"
                        }`}
                      >
                        {on && "✓"}
                      </span>
                      <span className="flex-1 truncate font-medium">{t.name}</span>
                      {t.added && <span className="text-xs text-muted">Added · re-map</span>}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep({ kind: "link" })}>
                Back
              </Button>
              <Button
                disabled={selected.size === 0}
                onClick={() => loadTab(step.sheet, step.sheet.tabs.filter((t) => selected.has(t.gid)), 0, NONE)}
              >
                Map {selected.size || ""} {selected.size === 1 ? "tab" : "tabs"}
              </Button>
            </div>
          </motion.div>
        )}

        {step.kind === "map" && (
          <motion.div key={`map-${step.index}`} {...slide}>
            {step.queue.length > 1 && (
              <p className="mb-2 text-sm text-muted">
                Tab {step.index + 1} of {step.queue.length}
              </p>
            )}
            {step.preview ? (
              <MappingEditor
                tabName={step.queue[step.index].name}
                grid={step.preview.grid}
                totalRows={step.preview.totalRows}
                initial={step.preview.mapping}
                origin={step.preview.origin}
                saving={pending}
                onSave={save}
                onSkip={() => advance(step.saved)}
              />
            ) : error ? null : (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-28 w-full rounded-[28px]" />
                <Skeleton className="h-80 w-full rounded-[28px]" />
              </div>
            )}
          </motion.div>
        )}

        {step.kind === "done" && (
          <motion.div key="done" {...slide} className="bubble p-8 text-center sm:p-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring.bouncy, delay: 0.1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-3xl text-white"
            >
              ✓
            </motion.div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">{step.sheet.title ?? "Sheet"} added</h2>
            <p className="mt-2 text-muted">
              {step.products.toLocaleString()} products from {step.tabs} {step.tabs === 1 ? "tab" : "tabs"}.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/sources" className="rounded-full px-5 py-2.5 text-sm font-medium text-accent hover:bg-hairline">
                My sheets
              </Link>
              <Link
                href="/"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110"
              >
                Go to store
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const steps = ["Link", "Tabs", "Map", "Done"];
  const current = { link: 0, tabs: 1, map: 2, done: 3 }[step.kind];
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${
              i <= current ? "bg-accent text-accent-contrast" : "bg-hairline text-muted"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === current ? "text-text" : "text-muted"}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-hairline sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}
