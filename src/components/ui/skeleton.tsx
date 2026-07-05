import { cn } from "@/lib/utils";

/**
 * Skeleton shimmer placeholder — modern replacement for spinners.
 * Uses the `shimmer` utility from styles.css.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer rounded-lg", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Preset skeleton rows for fare/driver/payment fetching. */
export function SkeletonFare() {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-card border border-border">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="border-t border-border pt-3 flex justify-between items-center">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  );
}

export function SkeletonDriver() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
      <Skeleton className="h-14 w-14 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-10 w-16 rounded-xl" />
    </div>
  );
}

export function SkeletonVehicle() {
  return (
    <div className="min-w-[172px] p-4 rounded-2xl bg-card border border-border space-y-3">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
