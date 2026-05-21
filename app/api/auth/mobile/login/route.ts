import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/helpers";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  authenticateCredentials,
  createMobileSession,
} from "@/lib/mobile-auth";
import { getUserPrimaryOrg } from "@/lib/permissions";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  deviceLabel: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`mobile-login:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await authenticateCredentials(
    parsed.data.email,
    parsed.data.password
  );
  if (!auth) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const tokens = await createMobileSession(auth.userId, parsed.data.deviceLabel);
  const org = await getUserPrimaryOrg(auth.userId);

  return NextResponse.json({
    ...tokens,
    tokenType: "Bearer",
    userId: auth.userId,
    orgId: org?.id ?? null,
  });
}
