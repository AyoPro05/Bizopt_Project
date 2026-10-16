import { getApiContext } from "@/lib/api-context";
import { verifyAccessToken } from "@/lib/mobile-auth";
import { requireSeoRole } from "@/services/seo/workspace";
import { SeoError } from "@/services/seo/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function getSeoContext(req: Request, mutation = false) {
  const authorization = req.headers.get("authorization");
  if (authorization && (!authorization.startsWith("Bearer ") || !verifyAccessToken(authorization.slice(7).trim()))) {
    throw new SeoError("Unauthorized", 401);
  }
  const context = await getApiContext({}, req);
  if (context.error) throw new SeoError(context.error, context.status);
  if (!context.org || !context.userId) throw new SeoError("Unauthorized", 401);
  if (process.env.SEO_INTELLIGENCE_ENABLED === "false") throw new SeoError("SEO Intelligence is currently unavailable.", 503);
  const betaOrgs = process.env.SEO_BETA_ORG_IDS?.split(",").map((id) => id.trim()).filter(Boolean);
  if (betaOrgs?.length && !betaOrgs.includes(context.org.id)) throw new SeoError("SEO Intelligence is in a private beta for selected workspaces.", 403);
  await requireSeoRole(context.org.id, context.userId, "edit");
  if (mutation && !rateLimit(`seo:${context.org.id}`, 30, 60_000).ok) throw new SeoError("Too many actions. Please wait a minute.", 429);
  return context;
}
