import Link from "next/link";
import { ErrorFallback } from "@/components/errors/error-fallback";

export default function NotFound() {
  return (
    <div className="surface-page flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <ErrorFallback
          title="Page not found"
          description="That route does not exist. You can return home and continue working."
          showHomeLink={false}
        />
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/home"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
          >
            Go to Home
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface)]"
          >
            Back to Landing
          </Link>
        </div>
      </div>
    </div>
  );
}
