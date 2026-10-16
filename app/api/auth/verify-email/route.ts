import { NextResponse } from "next/server";
import { identityAppOrigin, privateIdentityHeaders } from "@/lib/identity-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Old raw adapter proofs are obsolete. Never consume them on GET or copy them into another URL.
export async function GET(req: Request) {
  void req;
  return NextResponse.redirect(new URL("/verify-email?legacy=1",identityAppOrigin()),{status:303,headers:privateIdentityHeaders});
}
