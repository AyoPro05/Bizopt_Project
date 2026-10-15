"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{description}</p>
      {digest && <p className="mt-3 text-xs text-[var(--color-ink-subtle)]">Error ID: {digest}</p>}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {showHomeLink && (
          <Link href="/home">
            <Button size="sm" variant="secondary">
              Go to Home
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
