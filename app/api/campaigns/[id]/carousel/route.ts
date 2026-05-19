import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import {
  listCarouselSlides,
  createCarouselSlide,
  reorderCarouselSlides,
} from "@/services/media/carousel";
import { carouselSlideSchema, carouselReorderSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const slides = await listCarouselSlides(ctx.org.id, id);
  return NextResponse.json({ slides });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext({ requireEntitlement: true }, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await safeJson<unknown>(req);
  const reorder = carouselReorderSchema.safeParse(body);
  if (reorder.success) {
    const slides = await reorderCarouselSlides(
      ctx.org.id,
      id,
      reorder.data.orderedIds
    );
    return NextResponse.json({ slides });
  }

  const parsed = carouselSlideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const slide = await createCarouselSlide(ctx.org.id, id, parsed.data);
    return NextResponse.json({ slide }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
