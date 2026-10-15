import { z } from "zod";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson } from "@/lib/platform-http";
import { supportError, supportJson } from "@/lib/support-http";
import { lockSupport, supportCookie, unlockSupport } from "@/services/support/access";
const input = z.object({ password: z.string().min(1).max(100), code: z.string().regex(/^\d{6}$/) }).strict();
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/support/staff" };
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const context = await getPlatformContext(req);
    const value = input.parse(await readJson(req, 1000));
    const grant = await unlockSupport(context, value.password, value.code);
    const response = supportJson({ expiresAt: grant.expiresAt });
    response.cookies.set(supportCookie, grant.token, { ...cookieOptions, maxAge: 600 });
    return response;
  } catch (error) { return supportError(error); }
}
export async function DELETE(req: Request) {
  try {
    mutationGuard(req);
    await lockSupport(await getPlatformContext(req));
    const response = supportJson({ locked: true });
    response.cookies.set(supportCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) { return supportError(error); }
}
