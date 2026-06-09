"use client";

import { ReactNode, useEffect } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Error caught by boundary:", event.error);
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return (
    <div>
      {fallback ? (
        <div>
          {fallback(
            new Error("An error occurred"),
            () => window.location.reload()
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
