import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { applyMediaEdit, listEdits } from "@/services/media/edits";
import { mediaEditSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";
import type { MediaEditOperation } from "@bizopt/core/media/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const edits = await listEdits(ctx.org.id, id);
  return NextResponse.json({ edits });
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
  const parsed = mediaEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const edit = await applyMediaEdit(
      ctx.org.id,
      id,
      parsed.data.operation as MediaEditOperation,
      parsed.data.params
    );
    return NextResponse.json({ edit }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Edit failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
