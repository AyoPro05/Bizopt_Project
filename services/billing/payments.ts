import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { invoiceIsPaid, providerId, type InvoicePurpose } from "./lifecycle";
/** Invoice snapshots must come from a current provider retrieval under the workspace lock. */
export async function recordPaymentFromInvoice(orgId: string, invoice: Stripe.Invoice, purpose: InvoicePurpose, subscriptionId: string, period: { start: Date; end: Date } | null, client: Prisma.TransactionClient = db) {
  const intent = typeof invoice.payment_intent === "object" ? invoice.payment_intent : null;
  const status = invoiceIsPaid(invoice) ? "succeeded" : intent?.status === "requires_action" ? "authentication_required" : invoice.status === "uncollectible" || (invoice.attempt_count > 0 && !invoice.paid) ? "failed" : invoice.status ?? "pending";
  const fields = { stripePaymentIntentId: providerId(invoice.payment_intent) ?? `inv_${invoice.id}`, stripeInvoiceId: invoice.id, subscriptionId, amountCents: invoiceIsPaid(invoice) ? invoice.amount_paid : invoice.amount_due, currency: invoice.currency, status, purpose, servicePeriodStart: period?.start, servicePeriodEnd: period?.end, hostedInvoiceUrl: invoice.hosted_invoice_url, failureCode: intent?.last_payment_error?.code ?? null };
  const existing = await client.payment.findFirst({ where: { orgId, stripeInvoiceId: invoice.id } });
  if (existing) return client.payment.update({ where: { id: existing.id }, data: fields });
  return client.payment.upsert({ where: { stripePaymentIntentId: providerId(invoice.payment_intent) ?? `inv_${invoice.id}` }, create: { orgId, ...fields }, update: fields });
}
