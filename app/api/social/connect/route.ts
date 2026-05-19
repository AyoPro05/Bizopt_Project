import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { appUrl } from "@/lib/helpers";
import { createOAuthState } from "@/lib/oauth-state";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(appUrl("/login"));
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.redirect(appUrl("/integrations?error=no_org"));
  }

  const platform = new URL(req.url).searchParams.get("platform");
  if (!platform) {
    return NextResponse.redirect(appUrl("/integrations?error=platform_required"));
  }

  const state = createOAuthState({
    orgId: org.id,
    userId: session.user.id,
    platform,
  });

  const callbackUri = appUrl("/api/social/callback");

  if (platform === "linkedin" && process.env.LINKEDIN_CLIENT_ID) {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile w_member_social");
    return NextResponse.redirect(url.toString());
  }

  const allowDemo =
    process.env.ALLOW_DEMO_OAUTH === "true" ||
    process.env.NODE_ENV === "development";
  if (allowDemo) {
    const demo = new URL(callbackUri);
    demo.searchParams.set("platform", platform);
    demo.searchParams.set("state", state);
    demo.searchParams.set("code", "demo_connected");
    return NextResponse.redirect(demo.toString());
  }

  return NextResponse.redirect(
    appUrl(`/integrations?error=oauth_not_configured&platform=${platform}`)
  );
}
