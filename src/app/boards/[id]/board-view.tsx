"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { spring } from "@/components/ui/motion";
import { ChangeBadges, ChangeList } from "@/components/pins/change-badges";
import { usePins } from "@/components/pins/pins-provider";
import { ProductCard } from "@/components/store/product-card";
import { ProductDetail } from "@/components/store/product-detail";
import { hasChanges, NO_CHANGES } from "@/lib/pins";
import type { BoardPin } from "@/server/pins";
import { deleteBoard, markSeen, removePin, renameBoard } from "../actions";

export function BoardView({ board }: { board: { id: string; name: string; pins: BoardPin[] } }) {
  const router = useRouter();
  const pinsApi = usePins();
  const [name, setName] = useState(board.name);
  const [editing, setEditing] = useState(false);
  const [pins, setPins] = useState(board.pins);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [open, setOpen] = useState<BoardPin | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const changedCount = pins.filter((p) => hasChanges(p.changes)).length;
  const shown = onlyChanged ? pins.filter((p) => hasChanges(p.changes)) : pins;

  const saveName = () =>
    start(async () => {
      setEditing(false);
      if (name.trim() === board.name) return;
      const res = await renameBoard(board.id, name);
      if (!res.ok) {
        setName(board.name);
        pinsApi.toast({ message: res.error });
      } else {
        setName(res.name);
        pinsApi.upsertBoard({ id: board.id, name: res.name });
      }
    });

  const unpin = (p: BoardPin) =>
    start(async () => {
      setPins((all) => all.filter((x) => x.key !== p.key));
      if (open?.key === p.key) setOpen(null);
      const res = await removePin(p.key, board.id);
      if (!res.ok) {
        setPins(board.pins);
        pinsApi.toast({ message: res.error });
        return;
      }
      pinsApi.setMembership(p.key, pinsApi.boardsFor(p.key).filter((id) => id !== board.id));
      pinsApi.toast({ message: `Removed from ${name}` });
    });

  const seen = (key?: string) =>
    start(async () => {
      const res = await markSeen(board.id, key);
      if (!res.ok) return pinsApi.toast({ message: res.error });
      // Clear badges locally (no-longer-listed pins keep theirs).
      setPins((all) =>
        all.map((p) => (!key || p.key === key) && !p.changes.removed ? { ...p, changes: NO_CHANGES } : p),
      );
      setOpen((o) => (o && (!key || o.key === key) && !o.changes.removed ? { ...o, changes: NO_CHANGES } : o));
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await deleteBoard(board.id);
      if (!res.ok) return pinsApi.toast({ message: res.error });
      pinsApi.dropBoard(board.id);
      router.push("/boards");
    });

  return (
    <>
      <Link href="/boards" className="text-sm text-muted hover:text-text">
        ← Boards
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                maxLength={40}
                aria-label="Board name"
                className="field text-3xl font-semibold tracking-tight"
              />
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} title="Rename board" className="text-left">
              <h1 className="truncate text-4xl font-semibold tracking-tight hover:opacity-80">{name}</h1>
            </button>
          )}
          <p className="mt-2 text-muted">
            {pins.length} {pins.length === 1 ? "pin" : "pins"}
            {changedCount > 0 && ` · ${changedCount} changed since pinned`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {changedCount > 0 && (
            <Button variant="secondary" onClick={() => seen()} disabled={pending}>
              Mark all as seen
            </Button>
          )}
          {confirmDelete ? (
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button variant="danger" onClick={remove} disabled={pending}>
                Delete board
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {changedCount > 0 && (
        <div className="mb-6 flex gap-2">
          <Chip group="board-filter" active={!onlyChanged} onClick={() => setOnlyChanged(false)}>
            All
          </Chip>
          <Chip group="board-filter" active={onlyChanged} onClick={() => setOnlyChanged(true)}>
            Changed <span className="opacity-60">{changedCount}</span>
          </Chip>
        </div>
      )}

      {pins.length === 0 ? (
        <div className="bubble mx-auto max-w-md p-8 text-center">
          <p className="text-lg font-medium">This board is empty</p>
          <p className="mt-1 text-sm text-muted">Pin products from the store to add them here.</p>
          <Link href="/" className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium text-accent hover:bg-hairline">
            Go to store
          </Link>
        </div>
      ) : (
        <LayoutGroup>
          <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence mode="popLayout">
              {shown.map((p, i) => (
                <motion.div
                  key={p.key}
                  layout
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={spring.soft}
                >
                  <ProductCard
                    product={p.product}
                    pinned
                    onPin={() => unpin(p)}
                    onOpen={() => setOpen(p)}
                    delay={Math.min(i * 0.03, 0.4)}
                    muted={p.changes.removed}
                    overlay={hasChanges(p.changes) ? <ChangeBadges changes={p.changes} /> : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <ProductDetail
            product={open?.product ?? null}
            pinned
            onPin={() => open && unpin(open)}
            onChooseBoards={open && !open.changes.removed ? () => pinsApi.choose(open.product) : undefined}
            onClose={() => setOpen(null)}
            changes={open ? <ChangeList changes={open.changes} onSeen={() => seen(open.key)} /> : null}
          />
        </LayoutGroup>
      )}
    </>
  );
}
