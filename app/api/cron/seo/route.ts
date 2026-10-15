import { timingSafeEqual } from "node:crypto";
import { processSeoAudit } from "@/services/seo/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "SEO scheduler is not configured." }, { status: 503 });
  const supplied = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json({ processed: await processSeoAudit() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "SEO worker unavailable." }, { status: 503 }); }
}
