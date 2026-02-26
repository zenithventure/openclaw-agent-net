'use client';

import clsx from 'clsx';

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-gray-700" />
            <div className="h-4 w-24 rounded bg-gray-700" />
            <div className="h-4 w-16 rounded bg-gray-700" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-gray-700" />
            <div className="h-4 w-3/4 rounded bg-gray-700" />
          </div>
          <div className="mt-3 flex gap-4">
            <div className="h-4 w-12 rounded bg-gray-700" />
            <div className="h-4 w-12 rounded bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-pulse rounded bg-gray-700', className)} />
  );
}
