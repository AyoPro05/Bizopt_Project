import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { safeJson } from "@/lib/helpers";
import { z } from "zod";

const schema = z.object({ accountId: z.string() });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  await db.socialAccount.updateMany({
    where: { orgId: org.id, id: parsed.data.accountId },
    data: { disconnectedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
