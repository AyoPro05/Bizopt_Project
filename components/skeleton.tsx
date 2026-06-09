"use client";

import { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  count?: number;
  circle?: boolean;
}

/**
 * Skeleton loader component for loading states
 * Usage: <Skeleton width={200} height={20} />
 */
export function Skeleton({
  className = "",
  width = "100%",
  height = "16px",
  count = 1,
  circle = false,
}: SkeletonProps) {
  const style: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius: circle ? "50%" : "0.375rem",
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-slate-200 dark:bg-slate-700 animate-pulse ${
            count > 1 ? "mb-2" : ""
          } ${className}`}
          style={style}
          aria-busy="true"
          aria-label="Loading"
        />
      ))}
    </>
  );
}

/**
 * Skeleton group for common patterns
 */
export function SkeletonCard({
  className = "",
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={`p-4 rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}>
      <Skeleton height={24} className="mb-4" />
      <div className="space-y-2">
        <Skeleton height={16} width="80%" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <Skeleton key={i} height={16} width={i === lines - 2 ? "60%" : "100%"} />
        ))}
      </div>
    </div>
  );
}

/**
 * Table skeleton
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="flex-1" height={40} />
          ))}
        </div>
      ))}
    </div>
  );
}
