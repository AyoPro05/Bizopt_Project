import { createHash } from "node:crypto";
import { BILLING } from "@/lib/constants";

export type PlanKey = "base" | "team";
export type PlanDefinition = { key: PlanKey; label: string; capacity: number; amountCents: number; currency: string; interval: "month" };

/** Team is one fixed recurring amount. Integer arithmetic rounds half up in minor units. */
export function getPlanDefinition(key: PlanKey, baseAmountCents: number = BILLING.amountCents, currency: string = BILLING.currency): PlanDefinition {
  if (!Number.isSafeInteger(baseAmountCents) || baseAmountCents < 1 || baseAmountCents > 100000000) throw new Error("Invalid base recurring amount");
  if (key !== "base" && key !== "team") throw new Error("Unknown plan");
  return { key, label: key === "base" ? "Base" : "Team", capacity: key === "base" ? 2 : 5, amountCents: key === "base" ? baseAmountCents : Number((BigInt(baseAmountCents) * BigInt(140) + BigInt(50)) / BigInt(100)), currency: currency.toLowerCase(), interval: "month" };
}

type ProviderPrice = { id: string; active?: boolean; currency: string; unit_amount: number | null; type?: string; billing_scheme?: string; transform_quantity?: unknown; recurring?: { interval: string; interval_count: number; usage_type?: string } | null };
export function assertPlanPrice(price: ProviderPrice, plan: PlanDefinition): void {
  if (!price.active || price.unit_amount !== plan.amountCents || price.currency !== plan.currency || price.type !== "recurring" || price.billing_scheme !== "per_unit" || price.transform_quantity || price.recurring?.interval !== plan.interval || price.recurring?.interval_count !== 1 || (price.recurring.usage_type && price.recurring.usage_type !== "licensed")) {
    throw new Error(`${plan.label} configured Stripe price must match the approved amount, currency, monthly interval and fixed billing model`);
  }
}

export function planForProviderPrice(price: ProviderPrice, quantity: number | null | undefined, ids = { base: process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_ID, team: process.env.STRIPE_TEAM_PRICE_ID }): PlanDefinition {
  if (quantity !== 1) throw new Error("Plan quantity must be 1; per-seat billing is not approved");
  const key = price.id === ids.base ? "base" : price.id === ids.team ? "team" : null;
  if (!key) throw new Error("Provider price is not an approved Base or Team price");
  const plan = getPlanDefinition(key);
  assertPlanPrice(price, plan);
  return plan;
}

type ChangeableSubscription = { status: string; collection_method: string; current_period_end: number; items: { data: unknown[] }; discounts?: unknown[]; discount?: unknown; pending_update?: unknown; schedule?: unknown; cancel_at_period_end?: boolean; pause_collection?: unknown; latest_invoice?: string | { paid?: boolean } | null };
export function assertChangeSupported(sub: ChangeableSubscription): void {
  if (sub.status !== "active") throw new Error("Plan changes require an active paid period. Trial upgrades and overdue subscriptions need a defined billing policy first.");
  if (sub.collection_method !== "charge_automatically") throw new Error("This collection method is not supported for safe pending-payment upgrades");
  if (sub.items.data.length !== 1) throw new Error("Subscriptions with multiple items require billing review");
  if (sub.discounts?.length || sub.discount) throw new Error("Discounted subscription changes need an approved discount policy");
  if (sub.pending_update) throw new Error("A payment is already pending; finish that payment before another plan change");
  if (sub.schedule) throw new Error("A provider schedule already exists; reconcile or cancel it before another plan change");
  if (sub.cancel_at_period_end || sub.pause_collection) throw new Error("Cancelled or paused subscriptions require billing review");
  if (!sub.latest_invoice || typeof sub.latest_invoice === "string" || !sub.latest_invoice.paid) throw new Error("The current period invoice must be confirmed paid before changing plan");
  if (sub.current_period_end * 1000 <= Date.now()) throw new Error("Renewal is in progress; refresh once billing has reconciled");
}

type InvoiceInput = { id?: string; currency: string; amount_due: number; subtotal: number; total: number; total_tax_amounts?: { amount: number }[] | null; total_discount_amounts?: { amount: number }[] | null; lines: { has_more?: boolean; data: { description?: string | null; amount: number; proration?: boolean; period?: { start: number; end: number } }[] } };
export function invoiceSummary(invoice: InvoiceInput) {
  if (invoice.lines.has_more) throw new Error("A complete invoice preview is required before approval");
  return { invoiceId: invoice.id ?? null, currency: invoice.currency, amountDueCents: invoice.amount_due, subtotalCents: invoice.subtotal, totalCents: invoice.total, taxCents: (invoice.total_tax_amounts ?? []).reduce((sum, row) => sum + row.amount, 0), discountCents: (invoice.total_discount_amounts ?? []).reduce((sum, row) => sum + row.amount, 0), lines: invoice.lines.data.map(line => ({ description: line.description ?? "Subscription adjustment", amountCents: line.amount, proration: line.proration ?? false, period: line.period ?? null })) };
}

export function quoteHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
