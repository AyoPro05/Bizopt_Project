import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { disconnectPlatform } from "@/lib/platform-accounts";
import { safeJson } from "@/lib/helpers";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().optional(),
  platform: z.string().optional(),
});

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
    return NextResponse.json({ error: "accountId or platform required" }, { status: 400 });
  }

  const { accountId, platform } = parsed.data;
  if (!accountId && !platform) {
    return NextResponse.json({ error: "accountId or platform required" }, { status: 400 });
  }

  if (accountId) {
    const account = await db.socialAccount.findFirst({
      where: { orgId: org.id, id: accountId },
    });
    if (account) {
      await disconnectPlatform(org.id, account.platform, account.accountId);
    }
  } else if (platform) {
    await disconnectPlatform(org.id, platform);
  }

  return NextResponse.json({ ok: true });
}
