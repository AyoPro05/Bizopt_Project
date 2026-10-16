import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  const liveKey = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  const secret = (liveKey ? process.env.STRIPE_WEBHOOK_SECRET_LIVE : process.env.STRIPE_WEBHOOK_SECRET_TEST) || process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      secret
    );
  } catch {
    logger.error("webhook_signature_invalid");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (process.env.STRIPE_SECRET_KEY && event.livemode !== liveKey) return NextResponse.json({ error: "Provider event mode does not match this environment" }, { status: 400 });

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
  // The independent inbox worker processes accepted events with bounded retry/dead-letter handling.
  return NextResponse.json({ received: true });
}
