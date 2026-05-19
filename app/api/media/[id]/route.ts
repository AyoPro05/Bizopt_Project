import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { getAsset, deleteAsset, updateAssetMeta } from "@/services/media/assets";
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
  const asset = await getAsset(ctx.org.id, id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await safeJson<{
    width?: number;
    height?: number;
    durationMs?: number;
  }>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  await updateAssetMeta(ctx.org.id, id, body);
  const asset = await getAsset(ctx.org.id, id);
  return NextResponse.json({ asset });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext({ requireEntitlement: true }, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const ok = await deleteAsset(ctx.org.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
