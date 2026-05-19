import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg, requireActiveEntitlement } from "@/lib/permissions";
import { createBriefWithVariants } from "@/services/ai/generate-variants";
import { aiGenerateSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const entitled = await requireActiveEntitlement(org.id);
  if (!entitled) {
    return NextResponse.json(
      { error: "Start your trial or subscription to use AI Studio" },
      { status: 402 }
    );
  }

  const body = await safeJson<unknown>(req);
  const parsed = aiGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createBriefWithVariants(
    org.id,
    session.user.id,
    parsed.data.prompt,
    { tone: parsed.data.tone }
  );

  return NextResponse.json({
    brief: result.brief,
    variants: result.variants,
  });
}
