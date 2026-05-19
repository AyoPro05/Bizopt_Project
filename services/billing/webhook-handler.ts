import type Stripe from "stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { addDays } from "date-fns";
import { BILLING } from "@/lib/constants";
import {
  activateEntitlement,
  activateTrialing,
  revokeEntitlement,
  setGracePeriod,
  setPastDue,
  setTrialEnded,
} from "./entitlements";
import { upsertSubscriptionFromStripe } from "./subscriptions";
import { recordPaymentFromInvoice, recordPaymentIntent } from "./payments";
import { syncRefundFromStripe } from "./refunds";

async function resolveOrgIdFromStripe(
  customerId: string,
  metadataOrgId?: string | null
): Promise<string | null> {
  if (metadataOrgId) return metadataOrgId;
  const sub = await db.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });
  return sub?.orgId ?? null;
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      if (!orgId) {
        logger.warn("checkout.session.completed missing orgId", { eventId: event.id });
        return;
      }
      await db.entitlement.updateMany({
        where: { orgId },
        data: { userFacingState: "webhook_syncing" },
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId =
        sub.metadata?.orgId ??
        (await resolveOrgIdFromStripe(
          typeof sub.customer === "string" ? sub.customer : sub.customer.id
        ));
      if (!orgId) return;

      const record = await upsertSubscriptionFromStripe(orgId, sub);
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

      if (sub.status === "trialing") {
        await activateTrialing(orgId, record.id, trialEnd);
      } else if (sub.status === "active") {
        await activateEntitlement(
          orgId,
          record.id,
          new Date(sub.current_period_end * 1000)
        );
        if (trialEnd && trialEnd < new Date()) {
          await db.subscription.update({
            where: { orgId },
            data: { trialConvertedAt: new Date() },
          });
        }
      } else if (sub.status === "past_due") {
        await setPastDue(orgId, record.id);
        await db.subscription.update({
          where: { orgId },
          data: { graceUntil: addDays(new Date(), BILLING.gracePeriodDays) },
        });
        await setGracePeriod(orgId, addDays(new Date(), BILLING.gracePeriodDays));
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        if (sub.cancel_at_period_end && sub.status !== "canceled") {
          await db.entitlement.update({
            where: { orgId },
            data: {
              userFacingState: "canceled",
              accessUntil: new Date(sub.current_period_end * 1000),
            },
          });
        } else {
          await revokeEntitlement(orgId);
        }
      }
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId =
        sub.metadata?.orgId ??
        (await resolveOrgIdFromStripe(
          typeof sub.customer === "string" ? sub.customer : sub.customer.id
        ));
      if (!orgId) return;
      logger.info("trial_will_end", { orgId, trialEnd: sub.trial_end });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId =
        sub.metadata?.orgId ??
        (await resolveOrgIdFromStripe(
          typeof sub.customer === "string" ? sub.customer : sub.customer.id
        ));
      if (!orgId) return;
      await revokeEntitlement(orgId);
      await db.subscription.update({
        where: { orgId },
        data: { status: "canceled", canceledAt: new Date() },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId =
        invoice.metadata?.orgId ??
        (await resolveOrgIdFromStripe(
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? ""
        ));
      if (!orgId) return;

      await recordPaymentFromInvoice(orgId, invoice, "succeeded");
      const sub = await db.subscription.findUnique({ where: { orgId } });
      if (sub) {
        if (invoice.billing_reason === "subscription_create" && sub.trialEndAt) {
          await activateTrialing(orgId, sub.id, sub.trialEndAt);
        } else {
          await activateEntitlement(orgId, sub.id, sub.currentPeriodEnd);
        }
      }
      break;
    }

    case "invoice.payment_failed":
    case "invoice.payment_action_required": {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId =
        invoice.metadata?.orgId ??
        (await resolveOrgIdFromStripe(
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? ""
        ));
      if (!orgId) return;

      if (event.type === "invoice.payment_failed") {
        await recordPaymentFromInvoice(orgId, invoice, "failed");
      }
      const sub = await db.subscription.findUnique({ where: { orgId } });
      if (sub) {
        if (sub.status === "trialing" || sub.trialEndAt) {
          await setTrialEnded(orgId);
        } else {
          await setPastDue(orgId, sub.id);
          await db.entitlement.update({
            where: { orgId },
            data: { userFacingState: "payment_failed" },
          });
        }
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orgId = pi.metadata?.orgId;
      if (!orgId) return;
      const sub = await db.subscription.findUnique({ where: { orgId } });
      await recordPaymentIntent(orgId, pi, sub?.id);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await syncRefundFromStripe(charge);
      const payment = await db.payment.findFirst({
        where: {
          stripePaymentIntentId:
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : undefined,
        },
      });
      if (payment) {
        await revokeEntitlement(payment.orgId, "refund_approved");
      }
      break;
    }

    default:
      logger.debug("unhandled_stripe_event", { type: event.type });
  }
}
