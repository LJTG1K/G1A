import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoard } from "@/server/pins";
import { BoardView } from "./board-view";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const { id } = await params;
  const { id: userId, supabase } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const board = await getBoard(supabase, userId, id);
  if (!board) notFound();
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <BoardView board={board} />
    </main>
  );
}
