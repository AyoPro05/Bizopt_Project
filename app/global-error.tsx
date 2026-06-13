"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorFallback } from "@/components/errors/error-fallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "app/global-error.tsx" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="surface-page flex min-h-screen items-center justify-center px-4">
        <ErrorFallback
          title="Something went wrong"
          description={error?.message || "A critical error occurred while loading the app."}
          digest={error.digest}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
