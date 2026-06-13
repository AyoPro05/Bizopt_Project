import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiContext } from "@/lib/api-context";
import { updateCarouselSlide, deleteCarouselSlide } from "@/services/media/carousel";
import { safeJson } from "@/lib/helpers";

const patchSlideSchema = z
  .object({
    caption: z.string().max(5000).optional(),
    mediaAssetId: z.string().min(1).nullable().optional(),
    sortOrder: z.number().int().min(0).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

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
  const parsed = patchSlideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await updateCarouselSlide(ctx.org.id, slideId, parsed.data);
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
