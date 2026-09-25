import { ProductGrid } from "@/components/store/product-grid";
import { StoreFilters } from "@/components/store/store-filters";
import { sampleProducts } from "@/lib/sample-products";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <section className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Store. <span className="text-muted">Every sheet, one place.</span>
        </h1>
      </section>
      <StoreFilters />
      <ProductGrid products={sampleProducts} />
    </main>
  );
}
