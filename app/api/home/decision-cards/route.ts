import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { computeHomeDecisionCards, getHomeDecisionCards } from "@/services/workspace/decision-cards";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const cards = await getHomeDecisionCards(org.id);
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const cards = await computeHomeDecisionCards(org.id, body?.forceRefresh !== false);
  return NextResponse.json(cards);
}
