import type { Metadata } from "next";
import { StorePage } from "@/components/store/store-page";

export const metadata: Metadata = { title: "Demo store" };

/** The featured sheet as a public storefront, no sign-in needed. */
export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  return <StorePage searchParams={await searchParams} forceDemo />;
}
