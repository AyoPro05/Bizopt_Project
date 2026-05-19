import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { slugify } from "@/lib/helpers";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  orgName: z.string().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`signup:${ip}`, 5, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Unable to create account with this email." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const orgName = parsed.data.orgName ?? `${parsed.data.name}'s workspace`;
  const slug = slugify(orgName) + "-" + Date.now().toString(36);

  const user = await db.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      settings: {
        create: { theme: "system" },
      },
      memberships: {
        create: {
          role: "owner",
          org: {
            create: {
              name: orgName,
              slug,
              subscription: {
                create: {
                  planId: "bizopt_pro_monthly",
                  status: "pending_payment",
                  currency: "usd",
                  amountCents: 999,
                  trialPriceCents: 99,
                  trialDays: 7,
                  requiresPaymentMethod: true,
                },
              },
              entitlement: {
                create: {
                  active: false,
                  userFacingState: "pending_payment",
                  deviceLimit: 1,
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
}
