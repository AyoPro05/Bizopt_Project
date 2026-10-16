import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SeoError } from "@/services/seo/errors";

export function checkSeoMutation(req: Request) {
  // Bearer authentication is validated by getApiContext, without cookie fallback.
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  const origin = req.headers.get("origin");
  const expected = process.env.SEO_APP_ORIGIN
    ? new URL(process.env.SEO_APP_ORIGIN).origin
    : new URL(req.url).origin;
  if (!origin || origin !== expected) throw new SeoError("Request origin is not allowed.", 403);
}

export async function readSeoJson(req: Request, limit = 1_100_000): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > limit) throw new SeoError("Request body is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new SeoError("A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new SeoError("Request body is too large.", 413);
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SeoError("The request must contain valid JSON.");
  }
}

export function seoHttpError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Please check your input." }, { status: 400 });
  }
  if (error instanceof SeoError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Database/provider details can contain URLs or credentials; never expose them.
  return NextResponse.json({ error: "SEO could not complete this action. Please try again." }, { status: 500 });
}
