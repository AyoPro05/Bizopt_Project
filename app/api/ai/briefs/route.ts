import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { listBriefs, getBriefWithVariants } from "@/services/ai/generate-variants";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const briefId = new URL(req.url).searchParams.get("id");
  if (briefId) {
    const brief = await getBriefWithVariants(org.id, briefId);
    if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ brief });
  }

  const briefs = await listBriefs(org.id);
  return NextResponse.json({ briefs });
}
