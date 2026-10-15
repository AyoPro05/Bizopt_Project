import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SeoError } from "@/services/seo/errors";
import { checkSeoMutation, readSeoJson } from "@/lib/seo-http";

export { AppError } from "@/services/platform/errors";
export const mutationGuard = checkSeoMutation;
export const readJson = readSeoJson;

export function platformError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Please check your input." }, { status: 400 });
  if (error instanceof SeoError) return NextResponse.json({ error: error.message }, { status: error.status });
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "P2034") return NextResponse.json({ error: "The workspace changed while this action was being saved. Refresh and try again." }, { status: 409 });
  if (code === "P2002") return NextResponse.json({ error: "This action has already been recorded. Refresh to see the latest state." }, { status: 409 });
  return NextResponse.json({ error: "This action could not be completed. Please try again." }, { status: 500 });
}
