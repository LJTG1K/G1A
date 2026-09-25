import { StorePage } from "@/components/store/store-page";

export default async function Home({ searchParams }: PageProps<"/">) {
  return <StorePage searchParams={await searchParams} />;
}
