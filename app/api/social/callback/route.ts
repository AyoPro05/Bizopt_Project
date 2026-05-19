import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/helpers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const orgId = searchParams.get("orgId");
  const code = searchParams.get("code");

  if (!platform || !orgId) {
    return NextResponse.redirect(appUrl("/settings?error=invalid_callback"));
  }

  if (code) {
    await db.socialAccount.upsert({
      where: {
        orgId_platform_accountId: {
          orgId,
          platform,
          accountId: `pending_${platform}`,
        },
      },
      create: {
        orgId,
        platform,
        accountId: `pending_${platform}`,
        accountName: `${platform} account`,
        accessToken: code,
      },
      update: {
        disconnectedAt: null,
        connectedAt: new Date(),
      },
    });
  }

  return NextResponse.redirect(appUrl("/settings?connected=" + platform));
}
