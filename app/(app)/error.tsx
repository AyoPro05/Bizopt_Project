"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
          <h1 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
            Oops!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Something unexpected happened in this section.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
            {error?.message || "An error occurred"}
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="w-full block px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded-lg transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="text-xs text-slate-500 mt-4">Error: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
