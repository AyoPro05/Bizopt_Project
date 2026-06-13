"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type ErrorFallbackProps = {
  title?: string;
  description?: string;
  digest?: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
};

export function ErrorFallback({
  title = "Something went wrong",
  description = "We hit an unexpected issue. Please try again.",
  digest,
  onRetry,
  showHomeLink = true,
}: ErrorFallbackProps) {
  return (
    <div className="card-panel mx-auto max-w-xl p-8 text-center shadow-[var(--shadow-elevated)]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{description}</p>
      {digest && <p className="mt-3 text-xs text-[var(--color-ink-subtle)]">Error ID: {digest}</p>}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
          >
            Try again
          </button>
        )}
        {showHomeLink && (
          <Link
            href="/home"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface)]"
          >
            Go to Home
          </Link>
        )}
      </div>
    </div>
  );
}
