import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-page min-h-dvh min-w-0">
      <header className="glass sticky top-0 z-50">
        <div className="mx-auto flex min-w-0 max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="inline-flex min-h-11 items-center font-display text-xl font-semibold text-[var(--color-ink)]">
            {APP_NAME}
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:gap-x-6">
            <Link href="/pricing" className="inline-flex min-h-11 items-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              Pricing
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)]"
            >
              Start trial — $0.99
            </Link>
          </nav>
        </div>
      </header>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
