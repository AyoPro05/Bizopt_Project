import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { updateCarouselSlide, deleteCarouselSlide } from "@/services/media/carousel";
import { safeJson } from "@/lib/helpers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { slideId } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await safeJson<{
    caption?: string;
    mediaAssetId?: string | null;
    sortOrder?: number;
  }>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  await updateCarouselSlide(ctx.org.id, slideId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slideId: string }> }
) {
  const { slideId } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  await deleteCarouselSlide(ctx.org.id, slideId);
  return NextResponse.json({ ok: true });
}
