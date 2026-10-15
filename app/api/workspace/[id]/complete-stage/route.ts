import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { transitionStage } from "@/services/workspace/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const { id } = await params;
  const body = await req.json();
  const { nextStage, updates } = body;

  const updated = await transitionStage(id, nextStage, updates);
  if (updated.orgId !== org.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(updated);
}
