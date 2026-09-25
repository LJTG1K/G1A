import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Boards" };

export default async function Page() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Boards</h1>
      <p className="mt-3 text-muted">Your private pin boards. Arrive in Milestone 5.</p>
    </main>
  );
}
