import { NextResponse } from "next/server";
import { getSeoContext } from "@/lib/seo-context";
import { checkSeoMutation, readSeoJson, seoHttpError } from "@/lib/seo-http";
import { createSeoSite, getSeoWorkspace } from "@/services/seo/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getSeoContext(req);
    return NextResponse.json({ ...await getSeoWorkspace(ctx.org.id, new URL(req.url).searchParams.get("siteId") ?? undefined), viewerId: ctx.userId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return seoHttpError(error); }
}

export async function POST(req: Request) {
  try {
    checkSeoMutation(req);
    const ctx = await getSeoContext(req, true);
    const site = await createSeoSite(ctx.org.id, ctx.userId, await readSeoJson(req, 10_000));
    return NextResponse.json({ ok: true, result: site }, { status: 201 });
  } catch (error) { return seoHttpError(error); }
}
