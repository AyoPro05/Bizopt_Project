import { NextResponse } from "next/server";
import { getSeoContext } from "@/lib/seo-context";
import { seoHttpError } from "@/lib/seo-http";
import { getSeoContent, exportSeoContent } from "@/services/seo/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ siteId: string; contentId: string }> }) {
  try {
    const ctx = await getSeoContext(req);
    const { siteId, contentId } = await params;
    if (new URL(req.url).searchParams.get("export") === "1") {
      const output = await exportSeoContent(ctx.org.id, siteId, contentId);
      return new Response(output.markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${output.filename}"`, "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(await getSeoContent(ctx.org.id, siteId, contentId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return seoHttpError(error); }
}
