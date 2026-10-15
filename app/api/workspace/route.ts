import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { getWorkspace, previewInvitations, confirmInvitations, updateInvitation, changeMembership } from "@/services/workspace";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/services/platform/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.string().min(1).max(100);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview_invites"), emails: z.array(z.string().email()).min(1).max(5), role: z.enum(["admin", "member"]) }),
  z.object({ action: z.literal("confirm_invites"), approvalId: id }),
  z.object({ action: z.literal("revoke_invite"), inviteId: id }),
  z.object({ action: z.literal("resend_invite"), inviteId: id }),
  z.object({ action: z.literal("remove_member"), memberId: id, expectedVersion: z.number().int().nonnegative() }),
  z.object({ action: z.literal("change_role"), memberId: id, expectedVersion: z.number().int().nonnegative(), role: z.enum(["admin", "member"]) }),
  z.object({ action: z.literal("transfer_ownership"), memberId: id, expectedVersion: z.number().int().nonnegative(), password: z.string().min(1).max(100) }),
]);
export async function GET(req: Request) {
  try { const ctx = await getPlatformContext(req); return NextResponse.json(await getWorkspace(ctx.org.id, ctx.userId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return platformError(error); }
}
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const ctx = await getPlatformContext(req, "workspace.manage");
    if (!rateLimit(`workspace:${ctx.org.id}`, 20, 60_000).ok) throw new AppError("Too many workspace actions. Please wait a minute.", 429);
    const input = schema.parse(await readJson(req, 5000));
    let result: unknown;
    switch (input.action) {
      case "preview_invites": result = await previewInvitations(ctx.org.id, ctx.userId, input); break;
      case "confirm_invites": result = await confirmInvitations(ctx.org.id, ctx.userId, input.approvalId); break;
      case "revoke_invite": result = await updateInvitation(ctx.org.id, ctx.userId, input.inviteId, "revoke"); break;
      case "resend_invite": result = await updateInvitation(ctx.org.id, ctx.userId, input.inviteId, "resend"); break;
      default: result = await changeMembership(ctx.org.id, ctx.userId, input); break;
    }
    return NextResponse.json({ ok: true, result: result ?? null });
  } catch (error) { return platformError(error); }
}
