import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-50 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-xl font-semibold text-[var(--color-ink)]">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/pricing" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              Pricing
            </Link>
            <Link href="/login" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-hover)]"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
