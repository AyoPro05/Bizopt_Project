import Link from "next/link";
import Image from "next/image";
import { BILLING } from "@/lib/constants";
import {
  Calendar,
  Sparkles,
  Shield,
  Zap,
  Globe,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Direct API publishing",
    desc: "No clipboard hacks. Schedule once — posts go live via official platform APIs with honest status tracking.",
  },
  {
    icon: Calendar,
    title: "Unified planner",
    desc: "Calendar, drafts, and scheduled queue in one place. Never lose a post because you swiped a notification.",
  },
  {
    icon: Sparkles,
    title: "AI Studio",
    desc: "Generate captions tuned per network. Professional, casual, or bold — then edit before you publish.",
  },
  {
    icon: Globe,
    title: "Multi-account posting",
    desc: "Post to personal and business profiles on the same platform in one campaign.",
  },
  {
    icon: Shield,
    title: "Transparent billing",
    desc: `${BILLING.displayPrice}/mo in USD. Cancel at period end. Webhook-synced entitlements. 7-day refund window.`,
  },
  {
    icon: BarChart3,
    title: "Real analytics",
    desc: "Success rates, platform breakdown, and campaign health — not vanity metrics.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden px-6 pb-16 pt-16 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-accent-soft)_0%,_transparent_55%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-4 inline-block rounded-full bg-[var(--color-accent-soft)] px-4 py-1 text-sm font-medium text-[var(--color-accent-hover)]">
              AI Optimized Publishing
            </p>
            <h1 className="font-display text-balance text-4xl font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
              Manage social growth in{" "}
              <span className="text-[var(--color-accent)]">one honest place</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[var(--color-ink-muted)]">
              BizOpt combines scheduling, AI content, multi-platform publishing, and subscription
              billing built for reliability — not notification roulette.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="rounded-xl bg-[var(--color-accent)] px-6 py-3 font-medium text-white shadow-lg hover:bg-[var(--color-accent-hover)]"
              >
                Get started — {BILLING.displayPrice}/mo
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-3 font-medium hover:bg-[var(--color-surface)]"
              >
                See pricing
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[var(--color-accent-soft)] via-transparent to-amber-100/40 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl shadow-[var(--color-accent)]/10 ring-1 ring-black/5">
              <Image
                src="/images/hero-bizopt.png"
                alt="BizOpt dashboard with subscriber analytics, Stripe payment success, and AI Studio publishing to social networks"
                width={1400}
                height={788}
                priority
                className="h-auto w-full"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <Icon className="h-8 w-8 text-[var(--color-accent)]" />
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
