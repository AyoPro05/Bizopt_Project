import { handlePublicConfirmation } from "@/lib/identity-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return handlePublicConfirmation(req,"password-reset"); }
