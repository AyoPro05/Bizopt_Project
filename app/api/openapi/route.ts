import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";

/** Serves OpenAPI spec for Swift codegen (`openapi-generator` / `swift-openapi-generator`). */
export async function GET(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const path = join(process.cwd(), "docs", "openapi.yaml");
  const yaml = readFileSync(path, "utf8");
  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
