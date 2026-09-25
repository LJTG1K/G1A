import { ProductCardSkeleton, Skeleton } from "./skeleton";

/** Loading state shared by the store and board pages. */
export function GridPageSkeleton({ toolbar = true }: { toolbar?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-3/4 max-w-lg" />
      <Skeleton className="mt-4 h-5 w-48" />
      {toolbar && (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-12 w-full max-w-md rounded-[14px]" />
          <div className="flex gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-full" />
            ))}
          </div>
        </div>
      )}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}

export function ListPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 pb-24 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="mt-4 h-5 w-64" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[28px]" />
        ))}
      </div>
    </main>
  );
}
