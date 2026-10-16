import { getPlatformContext } from "@/lib/platform-context";
import { supportError } from "@/lib/support-http";
import { readAccountExport } from "@/services/account/data-export";
export async function GET(req: Request,{params}:{params:Promise<{id:string}>}) {
  try { const ctx=await getPlatformContext(req); const value=await readAccountExport(ctx.org.id,ctx.userId,(await params).id); return new Response(JSON.stringify(value,null,2),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":"attachment; filename=\"bizopt-account-export.json\"","Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}}); } catch(error) { return supportError(error); }
}
