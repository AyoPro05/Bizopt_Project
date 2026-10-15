"use client";

import Link from "next/link";
import { AccountMenu } from "@/components/account/account-menu";
import { Home, Menu } from "lucide-react";
import { DraftAutosaveIndicator } from "@/components/drafts/draft-autosave-indicator";
import { ThemeModeButton } from "@/components/shell/theme-mode-button";
import { useMobileNav } from "@/components/shell/mobile-nav-context";

export function AppTopbar({ title }: { title?: string }) {
  const { open } = useMobileNav();

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b shell-divider pb-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={open}
          aria-label="Open menu"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/home"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm font-medium text-[var(--color-ink-muted)] shadow-[var(--shadow-card)] transition-all duration-200 hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        {title && (
          <h1 className="min-w-0 break-words font-display text-lg font-semibold tracking-tight text-[var(--color-ink)]">
            {title}
          </h1>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <DraftAutosaveIndicator />
        <span className="flex min-h-11 min-w-11 items-center justify-center"><ThemeModeButton /></span>
        <AccountMenu />
      </div>
    </header>
  );
}
