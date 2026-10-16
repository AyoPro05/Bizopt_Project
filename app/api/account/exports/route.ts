import { getPlatformContext } from "@/lib/platform-context";
import { supportError, supportJson } from "@/lib/support-http";
import { listAccountExports } from "@/services/account/data-export";
export async function GET(req: Request) { try { const ctx=await getPlatformContext(req); return supportJson({exports:await listAccountExports(ctx.org.id,ctx.userId)}); } catch(error) { return supportError(error); } }
