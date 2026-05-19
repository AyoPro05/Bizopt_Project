"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { DraftAutosaveIndicator } from "@/components/drafts/draft-autosave-indicator";

export function AppTopbar({ title }: { title?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
      <div className="flex items-center gap-3">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-sm font-medium text-[var(--color-accent-hover)] transition hover:opacity-90"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        {title && (
          <h1 className="font-display text-lg font-semibold text-[var(--color-ink)]">{title}</h1>
        )}
      </div>
      <DraftAutosaveIndicator />
    </header>
  );
}
