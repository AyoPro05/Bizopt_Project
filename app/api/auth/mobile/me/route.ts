import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const [user, primaryOrg] = await Promise.all([
    db.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, email: true, name: true },
    }),
    getUserPrimaryOrg(ctx.userId),
  ]);

  const ent = primaryOrg
    ? await db.entitlement.findUnique({ where: { orgId: primaryOrg.id } })
    : null;

  return NextResponse.json({
    user,
    org: primaryOrg
      ? { id: primaryOrg.id, name: primaryOrg.name, slug: primaryOrg.slug }
      : null,
    entitlement: ent
      ? {
          active: ent.active,
          userFacingState: ent.userFacingState,
          deviceLimit: ent.deviceLimit,
        }
      : null,
  });
}
