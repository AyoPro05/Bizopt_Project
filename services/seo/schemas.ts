import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "Please complete all required fields.").max(max);
export const publicSiteUrl = z.string().trim().url("Enter a full HTTPS website URL.").superRefine((value, ctx) => {
  let url: URL;
  try { url = new URL(value); } catch { return; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.hash || url.search) {
    ctx.addIssue({ code: "custom", message: "Use an HTTPS website URL without credentials, query parameters, or a fragment." });
  }
}).transform((value) => new URL(value).href.replace(/\/$/, ""));

export const siteInput = z.object({
  url: publicSiteUrl,
  name: text(120),
  goal: text(500),
  services: text(1500),
  audience: text(500),
  locale: text(35).default("en-GB"),
  serviceAreas: z.array(text(120)).max(20).default([]),
  authorised: z.literal(true, { errorMap: () => ({ message: "Confirm you own this website or have permission to inspect its public pages." }) }),
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.").refine((v) => {
  const time = Date.parse(v);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v;
}, "Enter a valid date.");

export const versionInput = z.object({
  expectedVersion: z.number().int().min(1),
  title: text(200),
  description: z.string().trim().max(500),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens.").max(150),
  body: text(100_000),
});

export const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan") }),
  z.object({ action: z.literal("audit") }),
  z.object({ action: z.literal("cancel_audit"), runId: text(100) }),
  z.object({ action: z.literal("create_content"), opportunityId: text(100) }),
  z.object({ action: z.literal("save_content"), contentId: text(100), ...versionInput.shape }),
  z.object({ action: z.literal("opportunity"), opportunityId: text(100), status: z.enum(["open", "in_progress", "done", "dismissed"]), ownerId: z.string().max(100).nullable().optional(), dueAt: date.nullable().optional() }),
  z.object({ action: z.literal("local_check"), key: z.enum(["profile", "contact", "hours", "categories", "service_areas", "reviews", "landing_page"]), checked: z.boolean() }),
  z.object({ action: z.literal("outreach"), organisation: text(150), url: publicSiteUrl, relevance: text(1500) }),
  z.object({ action: z.literal("import"), csv: text(1_000_000), property: text(2048), startDate: date, endDate: date, searchType: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).default("web") }),
]);
