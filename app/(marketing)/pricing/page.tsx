import Link from "next/link";
import { BILLING } from "@/lib/constants";
import { Check } from "lucide-react";

const included = [
  `${BILLING.trialDisplayPrice} for ${BILLING.trialDays} days — payment method required`,
  `Then ${BILLING.displayPrice}/month, cancel at period end`,
  "AI Studio: 6 outputs per idea (caption, carousel, image, video, audio, thread)",
  "Multi-platform campaigns with LinkedIn first-class",
  "1 device per subscription",
  "Draft autosave & resume",
  "Light / dark theme",
  "Webhook-synced billing",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-center text-4xl font-semibold">Simple pricing</h1>
      <p className="mt-4 text-center text-[var(--color-ink-muted)]">
        Try BizOpt for {BILLING.trialDisplayPrice}. One device. Full AI content pack.
      </p>

      <div className="mt-12 rounded-3xl border-2 border-[var(--color-accent)] bg-[var(--color-card)] p-8 shadow-xl">
        <p className="text-sm font-medium text-[var(--color-accent)]">BizOpt Pro</p>
        <p className="mt-2 font-display text-5xl font-semibold">
          {BILLING.trialDisplayPrice}
          <span className="text-lg font-normal text-[var(--color-ink-muted)]">
            {" "}
            / {BILLING.trialDays} days
          </span>
        </p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Then {BILLING.displayPrice}/month in {BILLING.currency.toUpperCase()}. Card required at
          signup.
        </p>
        <ul className="mt-8 space-y-3">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/signup"
          className="mt-8 block rounded-xl bg-[var(--color-accent)] py-3 text-center font-medium text-white hover:bg-[var(--color-accent-hover)]"
        >
          Start trial
        </Link>
      </div>
    </div>
  );
}
