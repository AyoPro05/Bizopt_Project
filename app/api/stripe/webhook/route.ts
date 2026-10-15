import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { processStoredStripeEvent } from "@/services/billing/webhook-inbox";
import { Prisma } from "@prisma/client";
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
  } catch {
    logger.error("webhook_signature_invalid");
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
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      return NextResponse.json({ error: "Unable to store provider event" }, { status: 503 });
    }
  }
  try { await processStoredStripeEvent(event.id); }
  catch { return NextResponse.json({ error: "Provider event stored; processing will retry." }, { status: 503 }); }
  return NextResponse.json({ received: true });
}
