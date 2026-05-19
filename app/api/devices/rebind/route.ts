import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { rebindDevice } from "@/services/devices";
import { safeJson } from "@/lib/helpers";
import { z } from "zod";

const rebindSchema = z.object({
  oldFingerprint: z.string().min(8),
  newFingerprint: z.string().min(8),
  label: z.string().max(100).optional(),
  platform: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const body = await safeJson<unknown>(req);
  const parsed = rebindSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await rebindDevice(
    org.id,
    parsed.data.oldFingerprint,
    parsed.data.newFingerprint,
    { label: parsed.data.label, platform: parsed.data.platform }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code ?? 400 }
    );
  }

  return NextResponse.json({ device: result.device });
}
