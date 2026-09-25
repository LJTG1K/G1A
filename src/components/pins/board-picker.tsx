"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { spring } from "@/components/ui/motion";
import { createBoard, setPinBoards } from "@/app/boards/actions";
import type { Product } from "@/lib/store";
import { usePins } from "./pins-provider";

/** "Save to board" picker: tick any number of boards, or make a new one. */
export function BoardPicker({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: (boardIds: string[]) => void;
}) {
  return (
    <Sheet open={!!product} onClose={onClose} label="Save to board" size="sm">
      {/* Keyed so each opening starts from that product's current boards. */}
      {product && <PickerBody key={product.key} product={product} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function PickerBody({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (boardIds: string[]) => void;
}) {
  const { boards, boardsFor, setMembership, upsertBoard, toast } = usePins();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(boardsFor(product.key).filter((id) => id !== "pending")));
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addBoard = () =>
    start(async () => {
      setError(null);
      const res = await createBoard(newName);
      if (!res.ok) return setError(res.error);
      upsertBoard(res.board);
      setSelected((s) => new Set(s).add(res.board.id));
      setNewName("");
    });

  const save = () =>
    start(async () => {
      setError(null);
      const ids = [...selected];
      const res = await setPinBoards(product.key, ids);
      if (!res.ok) return setError(res.error);
      setMembership(product.key, res.boardIds);
      onSaved(res.boardIds);
      const names = boards.filter((b) => res.boardIds.includes(b.id)).map((b) => b.name);
      toast({ message: names.length ? `Saved to ${names.join(", ")}` : "Removed from your boards" });
      onClose();
    });

  return (
    <div className="p-5">
      <div className="flex items-center gap-3">
        {product.image && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet image hosts
          <img src={product.image} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Save to board</h2>
          <p className="truncate text-sm text-muted">{product.name}</p>
        </div>
      </div>

      <ul className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {boards.map((b) => {
            const on = selected.has(b.id);
            return (
              <motion.li key={b.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft}>
                <button
                  type="button"
                  onClick={() => toggle(b.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                    on ? "border-accent bg-accent/10" : "border-hairline bg-surface-2 hover:bg-hairline"
                  }`}
                >
                  <motion.span
                    animate={{ scale: on ? [1, 1.25, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                    className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] ${
                      on ? "border-accent bg-accent text-accent-contrast" : "border-hairline"
                    }`}
                  >
                    {on && "✓"}
                  </motion.span>
                  <span className="truncate font-medium">{b.name}</span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {boards.length === 0 && <li className="py-2 text-sm text-muted">No boards yet — create one below.</li>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) addBoard();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          placeholder="New board name"
          aria-label="New board name"
          className="field py-2.5 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={pending || !newName.trim()}>
          Add
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Done"}
        </Button>
      </div>
    </div>
  );
}
