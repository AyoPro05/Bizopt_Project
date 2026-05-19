import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { db } from "@/lib/db";
import { readStoredObject } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const asset = await db.asset.findFirst({
    where: { id, orgId: ctx.org.id },
  });
  if (!asset?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await readStoredObject(asset.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": asset.mimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
