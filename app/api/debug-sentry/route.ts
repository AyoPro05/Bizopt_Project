import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";

/**
 * Test endpoint for Sentry verification.
 * GET /api/debug-sentry to emit and throw a sample server error.
 */
async function authorizeDebugRoute(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug Sentry route is disabled in production." },
      { status: 404 }
    );
  }

  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  return null;
}

export async function GET(req: Request) {
  const denied = await authorizeDebugRoute(req);
  if (denied) return denied;

  const error = new Error("Sentry test error from /api/debug-sentry");
  Sentry.captureException(error, {
    tags: { test: "true", source: "debug-sentry-route" },
  });
  throw error;
}

export async function POST(req: Request) {
  const denied = await authorizeDebugRoute(req);
  if (denied) return denied;

  Sentry.captureMessage("Sentry test message from /api/debug-sentry", "info");
  return NextResponse.json({ ok: true, message: "Sentry test message sent" });
}
