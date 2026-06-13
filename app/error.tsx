"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorFallback } from "@/components/errors/error-fallback";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error, {
      tags: { boundary: "app/error.tsx" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="surface-page flex min-h-screen items-center justify-center px-4">
      <ErrorFallback
        title="Something went wrong"
        description="A temporary issue interrupted this page. Try again to continue."
        digest={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
