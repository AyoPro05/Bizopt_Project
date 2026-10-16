import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { AppError } from "@/services/platform/errors";
import { acceptInvitation, previewInvitationToken } from "@/services/workspace";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({ action: z.enum(["preview", "accept"]).default("accept"), id: z.string().min(1).max(100), token: z.string().regex(/^[a-f0-9]{64}$/) });
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    // This web acceptance flow must not use an arbitrary bearer header to bypass
    // cookie-origin checks and then authenticate with the browser session.
    if (req.headers.has("authorization")) throw new AppError("Use the signed-in web invitation flow.", 401);
    mutationGuard(req);
    if (!rateLimit(`invite-token:${clientIp(req)}`, 20, 60_000).ok) throw new AppError("Too many invitation attempts. Please wait a minute.", 429);
    const input = schema.parse(await readJson(req, 2000));
    if (input.action === "preview") return Response.json(await previewInvitationToken(input.id, input.token), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new AppError("Sign in with the matching verified email address first.", 401);
    return Response.json({ ok: true, result: await acceptInvitation(session.user.id, input.id, input.token) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
