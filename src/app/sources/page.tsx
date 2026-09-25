import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sheets" };

export default async function Page() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Sheets</h1>
      <p className="mt-3 text-muted">Paste a Google Sheets link and map its columns. Arrives in Milestone 3.</p>
    </main>
  );
}
