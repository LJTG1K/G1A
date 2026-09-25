"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { riseIn, spring, staggerGrid } from "@/components/ui/motion";
import { usePins } from "@/components/pins/pins-provider";
import type { BoardSummary } from "@/server/pins";
import { createBoard } from "./actions";

export function BoardsIndex({ boards }: { boards: BoardSummary[] }) {
  const router = useRouter();
  const { upsertBoard } = usePins();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const res = await createBoard(name);
      if (!res.ok) return setError(res.error);
      upsertBoard(res.board);
      router.push(`/boards/${res.board.id}`);
    });

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Boards</h1>
          <p className="mt-2 text-muted">Pins from any sheet, grouped your way. Changes show up automatically.</p>
        </div>
        <Button onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "New board"}</Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            className="mb-6 overflow-hidden"
          >
            <div className="bubble flex flex-wrap gap-2 p-4">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Winter fits"
                aria-label="Board name"
                className="field max-w-sm flex-1"
              />
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? "Creating…" : "Create"}
              </Button>
              {error && <p className="w-full text-sm text-danger">{error}</p>}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {boards.length === 0 ? (
        <div className="bubble mx-auto max-w-md p-8 text-center">
          <p className="text-lg font-medium">No boards yet</p>
          <p className="mt-1 text-sm text-muted">Tap the pin on any product in the store to start your first board.</p>
          <Link href="/" className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium text-accent hover:bg-hairline">
            Go to store
          </Link>
        </div>
      ) : (
        <motion.ul
          variants={staggerGrid}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4"
        >
          {boards.map((b) => (
            <motion.li key={b.id} variants={riseIn}>
              <Link href={`/boards/${b.id}`} className="group block">
                <motion.div
                  whileHover={{ y: -6, boxShadow: "var(--shadow-lift)" }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.soft}
                  className="bubble overflow-hidden p-3"
                >
                  <Mosaic covers={b.covers} />
                  <div className="px-1 pt-3 pb-1">
                    <h2 className="truncate text-[15px] font-semibold">{b.name}</h2>
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                      {b.count} {b.count === 1 ? "pin" : "pins"}
                      {b.changed > 0 && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">
                          {b.changed} changed
                        </span>
                      )}
                    </p>
                  </div>
                </motion.div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </>
  );
}

/** 2×2 cover of the board's newest pins. */
function Mosaic({ covers }: { covers: string[] }) {
  const cells = [0, 1, 2, 3];
  return (
    <div className="grid aspect-square grid-cols-2 gap-1 overflow-hidden rounded-[20px] bg-surface-2">
      {cells.map((i) => (
        <div key={i} className="overflow-hidden bg-hairline">
          {covers[i] && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet image hosts
            <img
              src={covers[i]}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
      ))}
    </div>
  );
}
