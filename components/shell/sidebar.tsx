"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Megaphone,
  Calendar,
  ImageIcon,
  Sparkles,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Settings,
  CreditCard,
  Smartphone,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/helpers";
import { APP_NAME } from "@/lib/constants";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/growth-intelligence", label: "Growth", icon: TrendingUp },
  { href: "/compliance-center", label: "Compliance", icon: ShieldCheck },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/devices", label: "Devices", icon: Smartphone },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink)]"
      role="navigation"
      aria-label="Main application navigation"
    >
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        <Link href="/home" className="font-display text-xl font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">AI · Publish · Grow</p>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Navigation menu">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
