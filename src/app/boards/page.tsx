import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getBoardSummaries } from "@/server/pins";
import { BoardsIndex } from "./boards-index";

export const metadata: Metadata = { title: "Boards" };

export default async function BoardsPage() {
  const { id: userId, supabase } = await requireUser();
  const boards = await getBoardSummaries(supabase, userId);
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <BoardsIndex boards={boards} />
    </main>
  );
}
