import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { bindDevice } from "@/services/devices";
import { deviceBindSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

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
  const parsed = deviceBindSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await bindDevice(org.id, parsed.data.fingerprint, {
    label: parsed.data.label,
    platform: parsed.data.platform,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code ?? 400 }
    );
  }

  return NextResponse.json({ device: result.device });
}
