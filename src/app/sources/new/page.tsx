import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AddSheetWizard } from "./add-sheet-wizard";

export const metadata: Metadata = { title: "Add a sheet" };

export default async function NewSourcePage({ searchParams }: PageProps<"/sources/new">) {
  await requireUser();
  const { url } = await searchParams;
  return (
    <main className="w-full flex-1 px-4 pt-10 pb-24 sm:px-6">
      <AddSheetWizard initialUrl={typeof url === "string" ? url : undefined} />
    </main>
  );
}
