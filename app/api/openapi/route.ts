import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

/** Serves OpenAPI spec for Swift codegen (`openapi-generator` / `swift-openapi-generator`). */
export async function GET() {
  const path = join(process.cwd(), "docs", "openapi.yaml");
  const yaml = readFileSync(path, "utf8");
  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
