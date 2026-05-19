import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { appUrl } from "@/lib/helpers";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const platform = new URL(req.url).searchParams.get("platform");
  if (!platform) {
    return NextResponse.json({ error: "platform required" }, { status: 400 });
  }

  const redirectUri = appUrl(`/api/social/callback?platform=${platform}&orgId=${org.id}`);
  return NextResponse.json({
    platform,
    authUrl: redirectUri,
    message: "Configure OAuth credentials for production",
  });
}
