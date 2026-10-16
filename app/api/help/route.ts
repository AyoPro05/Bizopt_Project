import { getPlatformContext } from "@/lib/platform-context";
import { supportError, supportJson } from "@/lib/support-http";
import { guideHelp, searchHelp } from "@/services/support/help";
export async function GET(req: Request) {
  try {
    await getPlatformContext(req);
    const params = new URL(req.url).searchParams;
    const query = (params.get("q") ?? "").slice(0, 200);
    return supportJson({ articles: searchHelp(query, params.get("category") ?? undefined), guide: guideHelp(query) });
  } catch (error) { return supportError(error); }
}
