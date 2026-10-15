"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/helpers";
import { APP_NAME } from "@/lib/constants";
import { nav } from "./nav-config";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r shell-divider bg-[var(--color-card)] text-[var(--color-ink)] lg:flex"
      role="navigation"
      aria-label="Main application navigation"
    >
      <div className="border-b shell-divider px-6 py-5">
        <Link
          href="/home"
          className="font-display text-xl font-semibold tracking-tight text-[var(--color-ink)]"
        >
          {APP_NAME}
        </Link>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">AI · Publish · Grow</p>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Navigation menu">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("nav-item relative min-h-11", active && "nav-item-active")}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-subtle)]"
                )}
                aria-hidden="true"
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
