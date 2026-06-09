"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500 mb-4">
            500
          </h1>
          <p className="text-xl font-semibold text-slate-100 mb-2">
            Something went wrong
          </p>
          <p className="text-slate-400 mb-6">
            We&apos;ve encountered an unexpected error. Our team has been notified.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <button
            onClick={() => reset()}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-teal-500/50 transition-all"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="w-full block px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            Go to Home
          </Link>
        </div>

        <p className="text-xs text-slate-500">
          {error.digest && `Error ID: ${error.digest}`}
        </p>
      </div>
    </div>
  );
}
