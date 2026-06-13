import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * Test endpoint for Sentry verification.
 * GET /api/debug-sentry to emit and throw a sample server error.
 */
export async function GET() {
  const error = new Error("Sentry test error from /api/debug-sentry");
  Sentry.captureException(error, {
    tags: { test: "true", source: "debug-sentry-route" },
  });
  throw error;
}

export async function POST() {
  Sentry.captureMessage("Sentry test message from /api/debug-sentry", "info");
  return NextResponse.json({ ok: true, message: "Sentry test message sent" });
}
