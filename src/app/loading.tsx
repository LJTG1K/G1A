import { Skeleton, ProductCardSkeleton } from "@/components/ui/skeleton";

/** Homepage loading state: hero + two shelves. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-3/4 max-w-lg" />
      <Skeleton className="mt-4 h-5 w-48" />
      <Skeleton className="mt-6 h-12 w-full max-w-xl rounded-full" />
      {[0, 1].map((s) => (
        <div key={s} className="mt-12">
          <Skeleton className="h-7 w-56" />
          <div className="mt-4 flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-[44vw] max-w-56 shrink-0 sm:w-52">
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
