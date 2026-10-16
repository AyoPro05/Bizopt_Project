import { NextResponse } from "next/server";
import { getSeoContext } from "@/lib/seo-context";
import { checkSeoMutation, readSeoJson, seoHttpError } from "@/lib/seo-http";
import { actionInput } from "@/services/seo/schemas";
import { requireSeoSite, createSeoPlan, queueSeoAudit, cancelSeoAudit, createSeoContent, saveSeoVersion, updateSeoOpportunity, saveLocalCheck, createOutreachDraft, importSeoSearch } from "@/services/seo/workspace";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    checkSeoMutation(req);
    const ctx = await getSeoContext(req, true);
    const { siteId } = await params;
    await requireSeoSite(ctx.org.id, siteId);
    const input = actionInput.parse(await readSeoJson(req));
    let result: unknown = null;
    switch (input.action) {
      case "plan": result = await createSeoPlan(ctx.org.id, siteId); break;
      case "audit": result = await queueSeoAudit(ctx.org.id, ctx.userId, siteId); break;
      case "cancel_audit": await cancelSeoAudit(ctx.org.id, siteId, input.runId); break;
      case "create_content": result = await createSeoContent(ctx.org.id, ctx.userId, siteId, input.opportunityId); break;
      case "save_content": {
        // The version service also scopes to org; this binds the selected destination site.
        const { db } = await import("@/lib/db");
        const content = await db.seoContent.findFirst({ where: { id: input.contentId, orgId: ctx.org.id, siteId } });
        if (!content) return NextResponse.json({ error: "Content not found." }, { status: 404 });
        result = await saveSeoVersion(ctx.org.id, ctx.userId, input.contentId, input);
        break;
      }
      case "opportunity": await updateSeoOpportunity(ctx.org.id, siteId, input.opportunityId, input); break;
      case "local_check": await saveLocalCheck(ctx.org.id, siteId, input.key, input.checked); break;
      case "outreach": result = await createOutreachDraft(ctx.org.id, ctx.userId, siteId, input); break;
      case "import": result = await importSeoSearch(ctx.org.id, ctx.userId, siteId, input); break;
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) { return seoHttpError(error); }
}
