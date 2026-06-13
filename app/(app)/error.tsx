"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="surface-page flex min-h-screen items-center justify-center px-4">
      <ErrorFallback
        title="Something went wrong in this area"
        description={error?.message || "This section failed to render. Try again."}
        digest={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
