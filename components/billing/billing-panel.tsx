"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BILLING } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { CheckCircle2 } from "lucide-react";

type Props = {
  status: string;
  userFacingState: string;
  currentPeriodEnd: Date | null;
  trialEndAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canRefund: boolean;
};

function normalizeStatus(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function humanizeStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getDisplayState(status: string, userFacingState: string) {
  const statusKey = normalizeStatus(status);
  const stateKey = normalizeStatus(userFacingState);

  if (statusKey === "pending_payment" || stateKey === "pending_payment") {
    return {
      label: stateKey === "trialing" ? "Trial Pending" : "Payment Required",
      tone: "bg-amber-50 text-amber-700 border border-amber-200",
      helper: "Add a payment method to activate your workspace and begin publishing.",
    };
  }
  if (stateKey === "trialing") {
    return {
      label: "Trial Active",
      tone: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      helper: "You have full access during your trial period.",
    };
  }
  if (stateKey === "active") {
    return {
      label: "Active",
      tone: "bg-slate-50 text-slate-700 border border-slate-200",
      helper: "Your subscription is active and in good standing.",
    };
  }
  if (stateKey === "grace_period" || stateKey === "past_due" || stateKey === "payment_failed") {
    return {
      label: "Billing Attention Needed",
      tone: "bg-amber-50 text-amber-700 border border-amber-200",
      helper: "Update billing details to avoid interruption.",
    };
  }
  if (stateKey === "canceled") {
    return {
      label: "Canceled",
      tone: "bg-slate-100 text-slate-600 border border-slate-200",
      helper: "Access remains available until the current period ends.",
    };
  }

  return {
    label: humanizeStatus(stateKey || statusKey || "unknown"),
    tone: "bg-slate-100 text-slate-600 border border-slate-200",
    helper: "Subscription state synced from secure billing webhooks.",
  };
}

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
  const displayState = getDisplayState(status, userFacingState);

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

  const stateKey = normalizeStatus(userFacingState);
  const isActive = ["active", "grace_period", "trialing"].includes(stateKey);
  const isTrialing = stateKey === "trialing";
  const includedFeatures = [
    "5 social channels",
    "Advanced AI generation pack",
    "Real-time compliance audits",
    "Growth prediction intelligence",
    "Draft autosave and recovery",
  ];

  return (
    <div className="space-y-6">
      <Card className="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--color-ink-muted)]">Plan</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${displayState.tone}`}>
                {displayState.label}
              </span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold">BizOpt Pro</h2>
            <p className="mt-1 text-[var(--color-ink-muted)]">
              {BILLING.trialDisplayPrice} for {BILLING.trialDays} days, then {BILLING.displayPrice}/mo ·{" "}
              {BILLING.currency.toUpperCase()}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{displayState.helper}</p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Status</dt>
                <dd className="mt-1 font-medium">{displayState.label}</dd>
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
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Cancellation scheduled — access until {formatDate(currentPeriodEnd)}.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {!isActive && (
                <Button onClick={checkout} disabled={!!loading}>
                  {loading === "checkout"
                    ? "Redirecting..."
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
          </div>

          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:border-l lg:border-t-0">
            <h3 className="font-medium text-[var(--color-ink)]">Included in this tier</h3>
            <ul className="mt-4 space-y-3">
              {includedFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-[var(--color-ink-muted)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
