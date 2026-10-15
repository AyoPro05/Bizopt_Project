import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { getAccount, updateProfile, updatePreferences, switchWorkspace, revokeSession, signOutAll, privacyRequest } from "@/services/account";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/services/platform/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const password = z.string().min(1).max(100);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile"), name: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal("preferences"), supportEmail: z.boolean(), localDraftRecovery: z.boolean() }),
  z.object({ action: z.literal("switch_workspace"), orgId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("revoke_session"), sessionId: z.string().min(1).max(100), password }),
  z.object({ action: z.literal("sign_out_all"), password }),
  z.object({ action: z.literal("privacy_request"), kind: z.enum(["export", "deletion"]), password }),
]);

export async function GET(req: Request) {
  try { const ctx = await getPlatformContext(req); return NextResponse.json(await getAccount(ctx.org.id, ctx.userId, ctx.sessionId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return platformError(error); }
}
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const ctx = await getPlatformContext(req);
    if (!rateLimit(`account:${ctx.userId}`, 20, 60_000).ok) throw new AppError("Too many account actions. Please wait a minute.", 429);
    const input = schema.parse(await readJson(req, 5000));
    let result: unknown = null;
    switch (input.action) {
      case "profile": await updateProfile(ctx.userId, input.name); break;
      case "preferences": await updatePreferences(ctx.userId, input); break;
      case "switch_workspace": await switchWorkspace(ctx.userId, input.orgId); break;
      case "revoke_session": await revokeSession(ctx.userId, input.sessionId, input.password); break;
      case "sign_out_all": await signOutAll(ctx.userId, input.password); break;
      case "privacy_request": result = await privacyRequest(ctx.org.id, ctx.userId, input.kind, input.password); break;
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) { return platformError(error); }
}
