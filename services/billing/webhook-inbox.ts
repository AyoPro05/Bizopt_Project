import { db } from "@/lib/db";
import { processStripeEvent } from "./webhook-handler";
import type Stripe from "stripe";

// A committed inbox row survives a crash between verification and processing.
export async function processStoredStripeEvent(eventId?: string) {
  const now = new Date();
  await db.stripeEvent.updateMany({ where: { processingStatus: "processing", attempts: { gte: 5 }, lockedAt: { lt: new Date(now.getTime() - 180_000) } }, data: { processingStatus: "dead_letter", lockedAt: null, errorMessage: "Final delivery lease expired. Review provider state before retrying." } });
  const due = {
    ...(eventId ? { eventId } : {}), attempts: { lt: 5 },
    OR: [
      { processingStatus: { in: ["pending", "failed"] }, nextAttemptAt: { lte: now } },
      { processingStatus: "processing", lockedAt: { lt: new Date(now.getTime() - 180_000) } },
    ],
  };
  const row = await db.stripeEvent.findFirst({ where: due, orderBy: { createdAt: "asc" } });
  if (!row) return false;
  const claimed = await db.stripeEvent.updateMany({ where: { id: row.id, ...due }, data: { processingStatus: "processing", lockedAt: now, attempts: { increment: 1 }, errorMessage: null } });
  if (!claimed.count) return false;
  const lease = { id: row.id, processingStatus: "processing", lockedAt: now };
  try {
    await processStripeEvent(row.payloadJson as unknown as Stripe.Event);
    await db.stripeEvent.updateMany({ where: lease, data: { processingStatus: "processed", processedAt: new Date(), lockedAt: null, errorMessage: null } });
  } catch {
    await db.stripeEvent.updateMany({ where: lease, data: { processingStatus: row.attempts + 1 >= 5 ? "dead_letter" : "failed", lockedAt: null, nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** row.attempts), errorMessage: "Provider event processing could not be confirmed. Review the inbox and provider state before retrying exhausted deliveries." } });
  }
  return true;
}
