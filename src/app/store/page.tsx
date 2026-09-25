import type { Metadata } from "next";
import { StorePage } from "@/components/store/store-page";

export const metadata: Metadata = { title: "All products" };

/** Every product from every sheet (or one spreadsheet with ?ss=), with search and filters. */
export default async function AllProductsPage({ searchParams }: PageProps<"/store">) {
  return <StorePage searchParams={await searchParams} />;
}
