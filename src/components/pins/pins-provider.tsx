"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/components/ui/motion";
import { removePin, savePin } from "@/app/boards/actions";
import type { Product } from "@/lib/store";
import { BoardPicker } from "./board-picker";

type Board = { id: string; name: string };
type Toast = { id: number; message: string; action?: { label: string; onClick: () => void }; href?: string };

type PinsApi = {
  signedIn: boolean;
  boards: Board[];
  pinCount: number;
  isPinned: (key: string) => boolean;
  boardsFor: (key: string) => string[];
  /** Tap on a pin button: pin to the last-used board, or unpin from all boards. */
  toggle: (product: Product) => void;
  /** Open the "Save to board" picker for a product. */
  choose: (product: Product) => void;
  /** Local updates after board changes made elsewhere (picker, board pages). */
  setMembership: (key: string, boardIds: string[]) => void;
  upsertBoard: (board: Board) => void;
  dropBoard: (id: string) => void;
  toast: (t: Omit<Toast, "id">) => void;
};

const Ctx = createContext<PinsApi | null>(null);
const LAST_BOARD = "g1a-last-board";

export function usePins() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePins outside PinsProvider");
  return v;
}

function readLast() {
  try {
    return localStorage.getItem(LAST_BOARD);
  } catch {
    return null;
  }
}
function writeLast(id: string) {
  try {
    localStorage.setItem(LAST_BOARD, id);
  } catch {}
}

export function PinsProvider({
  signedIn,
  initialBoards,
  initialPins,
  children,
}: {
  signedIn: boolean;
  initialBoards: Board[];
  initialPins: Record<string, string[]>;
  children: React.ReactNode;
}) {
  const [boards, setBoards] = useState(initialBoards);
  const [pins, setPins] = useState(initialPins);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [picking, setPicking] = useState<Product | null>(null);
  const nextId = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++nextId.current;
    setToasts([{ ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 4000);
  }, []);

  const setMembership = useCallback((key: string, boardIds: string[]) => {
    setPins((prev) => {
      const next = { ...prev };
      if (boardIds.length) next[key] = boardIds;
      else delete next[key];
      return next;
    });
  }, []);

  const upsertBoard = useCallback((b: Board) => {
    setBoards((prev) => (prev.some((x) => x.id === b.id) ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b]));
  }, []);

  const dropBoard = useCallback((id: string) => {
    setBoards((prev) => prev.filter((b) => b.id !== id));
    setPins((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, ids] of Object.entries(prev)) {
        const left = ids.filter((x) => x !== id);
        if (left.length) next[k] = left;
      }
      return next;
    });
  }, []);

  const toggle = useCallback(
    async (product: Product) => {
      if (!signedIn) {
        toast({ message: "Sign in to pin products to your boards.", href: "/login" });
        return;
      }
      const before = pins[product.key] ?? [];
      if (before.length) {
        setMembership(product.key, []);
        const res = await removePin(product.key);
        if (!res.ok) {
          setMembership(product.key, before);
          toast({ message: res.error });
        } else toast({ message: "Removed from your boards" });
        return;
      }
      // Optimistic: show as pinned immediately, confirm the board name when the server answers.
      setMembership(product.key, ["pending"]);
      const res = await savePin(product.key, readLast());
      if (!res.ok) {
        setMembership(product.key, []);
        toast({ message: res.error });
        return;
      }
      upsertBoard(res.board);
      setMembership(product.key, [res.board.id]);
      writeLast(res.board.id);
      toast({
        message: `Saved to ${res.board.name}`,
        action: { label: "Change", onClick: () => setPicking(product) },
      });
    },
    [signedIn, pins, setMembership, upsertBoard, toast],
  );

  const choose = useCallback(
    (product: Product) => {
      if (!signedIn) toast({ message: "Sign in to pin products to your boards.", href: "/login" });
      else setPicking(product);
    },
    [signedIn, toast],
  );

  const api = useMemo<PinsApi>(
    () => ({
      signedIn,
      boards,
      pinCount: Object.keys(pins).length,
      isPinned: (key) => (pins[key]?.length ?? 0) > 0,
      boardsFor: (key) => pins[key] ?? [],
      toggle,
      choose,
      setMembership,
      upsertBoard,
      dropBoard,
      toast,
    }),
    [signedIn, boards, pins, toggle, choose, setMembership, upsertBoard, dropBoard, toast],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <BoardPicker
        product={picking}
        onClose={() => setPicking(null)}
        onSaved={(ids) => ids[0] && writeLast(ids[ids.length - 1])}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={spring.snappy}
              role="status"
              className="glass pointer-events-auto flex items-center gap-4 rounded-full border border-hairline px-5 py-3 text-sm shadow-[var(--shadow-lift)]"
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    setToasts([]);
                  }}
                  className="font-medium text-accent"
                >
                  {t.action.label}
                </button>
              )}
              {t.href && (
                <Link href={t.href} className="font-medium text-accent">
                  Sign in
                </Link>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
