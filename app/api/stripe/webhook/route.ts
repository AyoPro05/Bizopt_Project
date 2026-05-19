import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { processStripeEvent } from "@/services/billing/webhook-handler";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("webhook_signature_invalid", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await db.stripeEvent.create({
      data: {
        eventId: event.id,
        type: event.type,
        livemode: event.livemode,
        payloadJson: event as object,
        processingStatus: "pending",
      },
    });
  } catch (err) {
    const isDuplicate =
      err instanceof Error && err.message.includes("Unique constraint");
    if (isDuplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  try {
    await processStripeEvent(event);
    await db.stripeEvent.update({
      where: { eventId: event.id },
      data: {
        processingStatus: "processed",
        processedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    logger.error("webhook_processing_failed", { eventId: event.id, error: message });
    await db.stripeEvent.update({
      where: { eventId: event.id },
      data: {
        processingStatus: "failed",
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
