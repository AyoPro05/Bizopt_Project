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
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      {icon ? (
        <div className="mb-4 text-slate-400 dark:text-slate-500">{icon}</div>
      ) : (
        <Inbox className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-700" />
      )}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
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
      icon={<Search className="w-12 h-12" />}
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
      icon={<Inbox className="w-12 h-12" />}
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
      icon={<AlertCircle className="w-12 h-12 text-red-500" />}
      title={title}
      description={description}
      action={action}
    />
  );
}
