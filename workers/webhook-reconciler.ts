import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { processStripeEvent } from "../services/billing/webhook-handler";
import type Stripe from "stripe";

async function reconcile() {
  const pending = await db.stripeEvent.findMany({
    where: { processingStatus: "failed" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  logger.info("webhook_reconciler_start", { count: pending.length });

  for (const row of pending) {
    try {
      const event = row.payloadJson as unknown as Stripe.Event;
      await processStripeEvent(event);
      await db.stripeEvent.update({
        where: { id: row.id },
        data: {
          processingStatus: "processed",
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      await db.stripeEvent.update({
        where: { id: row.id },
        data: { errorMessage: message },
      });
      logger.error("webhook_reconcile_failed", { eventId: row.eventId, error: message });
    }
  }
}

reconcile()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("webhook_reconciler_crash", { error: String(err) });
    process.exit(1);
  });
