import { NextResponse } from "next/server";
import { platformError } from "@/lib/platform-http";

export function supportJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" } });
}
export function supportError(error: unknown) {
  const response = platformError(error);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
