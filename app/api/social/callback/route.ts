import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { appUrl } from "@/lib/helpers";
import { verifyOAuthState } from "@/lib/oauth-state";
import { upsertConnectedPlatform } from "@/lib/platform-accounts";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(appUrl("/login"));
  }

  const { searchParams } = new URL(req.url);
  const stateToken = searchParams.get("state");
  const code = searchParams.get("code");
  const platform = searchParams.get("platform");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(appUrl(`/integrations?error=${error}`));
  }

  const state = verifyOAuthState(stateToken);
  if (!state) {
    return NextResponse.redirect(appUrl("/integrations?error=invalid_state"));
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org || org.id !== state.orgId || session.user.id !== state.userId) {
    return NextResponse.redirect(appUrl("/integrations?error=org_mismatch"));
  }

  const platformKey = platform ?? state.platform;
  if (!code) {
    return NextResponse.redirect(appUrl("/integrations?error=missing_code"));
  }

  const accountId =
    code === "demo_connected"
      ? `demo_${platformKey}_${org.id.slice(0, 8)}`
      : `oauth_${platformKey}_${code.slice(0, 12)}`;

  await upsertConnectedPlatform(
    org.id,
    platformKey,
    accountId,
    `${platformKey} account`
  );

  return NextResponse.redirect(appUrl(`/integrations?connected=${platformKey}`));
}
