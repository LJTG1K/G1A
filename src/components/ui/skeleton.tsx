export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-2xl ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="bubble overflow-hidden p-3">
      <Skeleton className="aspect-square w-full rounded-[20px]" />
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-2 mb-2 h-4 w-1/3" />
    </div>
  );
}
