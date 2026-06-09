"use client";

import { ReactNode } from "react";
import { AlertCircle, Inbox, Search } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Generic empty state component
 * Usage: <EmptyState title="No results" description="Try searching..." />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`card-panel flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-ink-subtle)]">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Empty search results state
 */
export function EmptySearchState({
  query,
  action,
}: {
  query?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<Search className="h-7 w-7" />}
      title="No results found"
      description={
        query ? `No results for "${query}". Try different keywords.` : undefined
      }
      action={action}
    />
  );
}

/**
 * Empty data list state
 */
export function EmptyListState({
  title = "Nothing here yet",
  description = "Get started by creating your first item.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<Inbox className="h-7 w-7" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

/**
 * Error state for failed data loading
 */
export function EmptyErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-7 w-7 text-[var(--color-danger)]" />}
      title={title}
      description={description}
      action={action}
    />
  );
}
