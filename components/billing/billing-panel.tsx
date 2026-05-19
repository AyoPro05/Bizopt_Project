"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BILLING } from "@/lib/constants";
import { formatDate } from "@/lib/dates";

type Props = {
  status: string;
  userFacingState: string;
  currentPeriodEnd: Date | null;
  trialEndAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canRefund: boolean;
};

export function BillingPanel({
  status,
  userFacingState,
  currentPeriodEnd,
  trialEndAt,
  cancelAtPeriodEnd,
  canRefund,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading("checkout");
    setError(null);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else {
      setError(data.error ?? "Checkout failed");
      setLoading(null);
    }
  }

  async function portal() {
    setLoading("portal");
    setError(null);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else {
      setError(data.error ?? "Could not open billing portal");
      setLoading(null);
    }
  }

  async function requestRefund() {
    if (!confirm("Request a full refund? This may revoke access immediately.")) return;
    setLoading("refund");
    setError(null);
    const res = await fetch("/api/stripe/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "customer_request" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Refund failed");
    setLoading(null);
    if (res.ok) window.location.reload();
  }

  const isActive = ["active", "grace_period", "trialing"].includes(userFacingState);
  const isTrialing = userFacingState === "trialing";

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-ink-muted)]">Plan</p>
            <h2 className="font-display text-2xl font-semibold">BizOpt Pro</h2>
            <p className="mt-1 text-[var(--color-ink-muted)]">
              {BILLING.trialDisplayPrice} for {BILLING.trialDays} days, then {BILLING.displayPrice}
              /mo · {BILLING.currency.toUpperCase()}
            </p>
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              Payment method required at signup. Cancel at period end anytime.
            </p>
          </div>
          <Badge status={userFacingState} />
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Status</dt>
            <dd className="mt-1 font-medium capitalize">{status}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              {isTrialing ? "Trial ends" : "Period ends"}
            </dt>
            <dd className="mt-1 font-medium">
              {formatDate(isTrialing ? trialEndAt : currentPeriodEnd)}
            </dd>
          </div>
        </dl>

        {cancelAtPeriodEnd && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Cancellation scheduled — access until {formatDate(currentPeriodEnd)}.
          </p>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          {!isActive && (
            <Button onClick={checkout} disabled={!!loading}>
              {loading === "checkout"
                ? "Redirecting…"
                : `Start trial — ${BILLING.trialDisplayPrice} for ${BILLING.trialDays} days`}
            </Button>
          )}
          {isActive && (
            <Button variant="secondary" onClick={portal} disabled={!!loading}>
              Manage subscription
            </Button>
          )}
          {canRefund && (
            <Button variant="ghost" onClick={requestRefund} disabled={!!loading}>
              Request refund
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
